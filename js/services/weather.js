/*
 * Météo Open-Meteo (gratuit, sans clé) : une seule requête pour toutes les
 * stations, à l'altitude de chaque foyer nordique.
 * Mise en cache 30 min sur l'appareil.
 */
import { readJSON, write } from './storage.js';

const CACHE_KEY = 'fondeur_weather';
const TTL = 30 * 60 * 1000;
const API = 'https://api.open-meteo.com/v1/forecast';

const HOURLY = ['temperature_2m', 'snowfall', 'rain', 'snow_depth'];
const DAILY = ['weather_code', 'temperature_2m_min', 'temperature_2m_max', 'snowfall_sum', 'rain_sum', 'wind_speed_10m_max'];

export function buildUrl(stations) {
  const p = new URLSearchParams({
    latitude: stations.map(s => s.lat).join(','),
    longitude: stations.map(s => s.lon).join(','),
    elevation: stations.map(s => s.alt).join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    past_days: '3',
    forecast_days: '6',
    timezone: 'Europe/Paris'
  });
  return `${API}?${p}`;
}

const sum = (arr, from, to) => arr.slice(Math.max(0, from), Math.max(0, to)).reduce((s, v) => s + (Number(v) || 0), 0);

/** Résumé exploitable pour une station à partir de la réponse Open-Meteo. */
export function summarize(raw, now = new Date()) {
  const h = raw.hourly;
  const d = raw.daily;
  const pad = n => String(n).padStart(2, '0');
  const hourKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
  const today = hourKey.slice(0, 10);
  let i = h.time.indexOf(hourKey);
  if (i < 0) i = h.time.findIndex(t => t > hourKey) - 1;
  if (i < 0) i = h.time.length - 1;
  // Nuit dernière : de 18 h la veille à 9 h ce matin
  const startNight = h.time.findIndex(t => t.startsWith(today)) - 6;
  const nightTemps = h.temperature_2m.slice(Math.max(0, startNight), Math.max(0, startNight) + 15).filter(v => v !== null);
  const di = d.time.indexOf(today);
  const depth = h.snow_depth?.[i];
  return {
    depth: depth === null || depth === undefined ? null : Math.round(depth * 100), // cm
    fresh24: Math.round(sum(h.snowfall, i - 23, i + 1)), // cm
    fresh72: Math.round(sum(h.snowfall, i - 71, i + 1)),
    rain48: Math.round(sum(h.rain, i - 47, i + 1) * 10) / 10, // mm
    tempNow: h.temperature_2m[i],
    tMinNight: nightTemps.length ? Math.min(...nightTemps) : d.temperature_2m_min[di],
    tMaxToday: d.temperature_2m_max[di],
    windMax: d.wind_speed_10m_max[di],
    code: d.weather_code[di],
    days: d.time.slice(di, di + 5).map((t, k) => ({
      date: t,
      code: d.weather_code[di + k],
      tmin: d.temperature_2m_min[di + k],
      tmax: d.temperature_2m_max[di + k],
      snow: d.snowfall_sum[di + k],
      rain: d.rain_sum[di + k]
    }))
  };
}

/** Météo de toutes les stations : { [stationId]: résumé }. */
export async function loadWeather(stations, { force = false } = {}) {
  const cached = readJSON(CACHE_KEY, null);
  if (!force && cached && Date.now() - cached.at < TTL && cached.ids === stations.map(s => s.id).join()) return { data: cached.data, at: cached.at, cached: true };
  const res = await fetch(buildUrl(stations));
  if (!res.ok) throw new Error(`Météo indisponible (${res.status})`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [json];
  const data = {};
  stations.forEach((s, k) => {
    try {
      data[s.id] = summarize(list[k]);
    } catch (error) {
      console.warn('[météo]', s.name, error);
    }
  });
  const at = Date.now();
  write(CACHE_KEY, JSON.stringify({ at, ids: stations.map(s => s.id).join(), data }));
  return { data, at, cached: false };
}

/** Codes météo WMO -> pictogramme et libellé. */
export function weatherLabel(code) {
  if (code === 0) return ['☀️', 'Ensoleillé'];
  if (code <= 2) return ['🌤', 'Éclaircies'];
  if (code === 3) return ['☁️', 'Couvert'];
  if (code <= 48) return ['🌫', 'Brouillard'];
  if (code <= 57) return ['🌦', 'Bruine'];
  if (code <= 67) return ['🌧', 'Pluie'];
  if (code <= 77) return ['🌨', 'Neige'];
  if (code <= 82) return ['🌧', 'Averses'];
  if (code <= 86) return ['🌨', 'Averses de neige'];
  return ['⛈', 'Orages'];
}
