/*
 * Temps de trajet en voiture depuis le point de départ (serveur public OSRM,
 * données OpenStreetMap), une seule requête pour toutes les stations.
 * Repli : distance à vol d'oiseau × 1,35 à 55 km/h de moyenne.
 * Mise en cache 7 jours par point de départ.
 */
import { readJSON, write } from './storage.js';

const TTL = 7 * 24 * 3600 * 1000;
const OSRM = 'https://router.project-osrm.org/table/v1/driving/';

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = x => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const estimate = (origin, s) => {
  const km = haversineKm(origin, s) * 1.35;
  return { minutes: Math.round((km / 55) * 60), km: Math.round(km), estimated: true };
};

/** { [stationId]: { minutes, km, estimated } } */
export async function loadRoutes(origin, stations) {
  const key = `fondeur_routes_${origin.lat.toFixed(3)}_${origin.lon.toFixed(3)}`;
  const cached = readJSON(key, null);
  if (cached && Date.now() - cached.at < TTL && stations.every(s => cached.data[s.id])) return cached.data;
  const fallback = Object.fromEntries(stations.map(s => [s.id, estimate(origin, s)]));
  try {
    const coords = [origin, ...stations].map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`${OSRM}${coords}?sources=0&annotations=duration,distance`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const json = await res.json();
    const data = {};
    stations.forEach((s, k) => {
      const sec = json.durations?.[0]?.[k + 1];
      const m = json.distances?.[0]?.[k + 1];
      data[s.id] = Number.isFinite(sec) ? { minutes: Math.round(sec / 60), km: Math.round((m || 0) / 1000), estimated: false } : fallback[s.id];
    });
    write(key, JSON.stringify({ at: Date.now(), data }));
    return data;
  } catch (error) {
    console.warn('[trajets] estimation à vol d’oiseau', error);
    return fallback;
  }
}

export function durationLabel(min) {
  if (!Number.isFinite(min)) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h${m ? ` ${String(m).padStart(2, '0')}` : ''}`;
}
