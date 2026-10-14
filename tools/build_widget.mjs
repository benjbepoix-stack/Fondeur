#!/usr/bin/env node
/*
 * Données des widgets (Scriptable, iPhone) -> data/widget.json
 *
 * Reprend exactement le calcul de l'app (js/core/score.js, wax.js, summary.js,
 * services/weather.js) : météo Open-Meteo de toutes les stations en une
 * requête, bulletins de data/bulletins.json, trajet depuis Ville-du-Pont.
 * Exécuté par GitHub Actions après le relevé des bulletins (TZ=Europe/Paris).
 * Usage : node tools/build_widget.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { buildUrl, summarize } from '../js/services/weather.js';
import { bulletinFor, computeScore } from '../js/core/score.js';
import { waxFor } from '../js/core/wax.js';
import { generalState } from '../js/core/summary.js';
import { RACES } from '../js/data/races.js';

const ROOT = new URL('../', import.meta.url);
const ORIGIN = { name: 'Ville-du-Pont', lat: 46.999, lon: 6.4989 };
const OSRM = 'https://router.project-osrm.org/table/v1/driving/';

const readJson = async path => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Trace-widget/1.0 (+https://github.com/benjbepoix-stack/Fondeur)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url.slice(0, 60)}… : HTTP ${res.status}`);
  return res.json();
}

/** Trajets depuis Ville-du-Pont (OSRM), repli à vol d'oiseau comme dans l'app. */
async function routes(stations) {
  const rad = x => (x * Math.PI) / 180;
  const crow = s => {
    const h = Math.sin(rad(s.lat - ORIGIN.lat) / 2) ** 2 + Math.cos(rad(ORIGIN.lat)) * Math.cos(rad(s.lat)) * Math.sin(rad(s.lon - ORIGIN.lon) / 2) ** 2;
    return Math.round(((2 * 6371 * Math.asin(Math.sqrt(h)) * 1.35) / 55) * 60);
  };
  try {
    const coords = [ORIGIN, ...stations].map(p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const json = await getJson(`${OSRM}${coords}?sources=0&annotations=duration`);
    return stations.map((s, k) => {
      const sec = json.durations?.[0]?.[k + 1];
      return Number.isFinite(sec) ? Math.round(sec / 60) : crow(s);
    });
  } catch (error) {
    console.warn('[trajets] estimation à vol d’oiseau :', error.message);
    return stations.map(crow);
  }
}

const wax = t => {
  const w = waxFor(t);
  return w ? { name: w.name, color: w.color } : null;
};
const round = n => (n === null || n === undefined ? null : Math.round(n));

async function main() {
  const { stations } = await readJson('data/stations.json');
  const bulletins = await readJson('data/bulletins.json');
  const raw = await getJson(buildUrl(stations));
  const list = Array.isArray(raw) ? raw : [raw];
  const minutes = await routes(stations);
  const now = new Date();

  const rows = stations.map((s, k) => {
    let wx = null;
    try {
      wx = summarize(list[k], now);
    } catch (error) {
      console.warn('[météo]', s.name, error.message);
    }
    const b = bulletinFor(s, bulletins);
    return { station: s, wx, bulletin: b, minutes: minutes[k], ...computeScore(wx, b) };
  });

  const out = rows
    .filter(r => r.score !== null)
    .sort((a, b) => b.score - a.score || a.minutes - b.minutes)
    .map(r => ({
      id: r.station.id,
      name: r.station.name,
      country: r.station.country,
      region: r.station.region,
      alt: r.station.alt,
      score: r.score,
      level: r.level,
      verdict: r.verdict,
      depth: r.depth,
      measured: r.measured,
      fresh72: r.wx.fresh72,
      tMin: round(r.wx.tMinNight),
      tMax: round(r.wx.tMaxToday),
      kmOpen: r.bulletin?.live && r.bulletin.kmTotal ? round(r.bulletin.kmOpen || 0) : null,
      kmTotal: r.bulletin?.live && r.bulletin.kmTotal ? round(r.bulletin.kmTotal) : null,
      minutes: r.minutes,
      waxAm: wax(r.wx.tMinNight),
      waxPm: wax(r.wx.tMaxToday)
    }));

  const today = now.toISOString().slice(0, 10);
  const races = RACES.flatMap(r => r.editions.map(e => ({ id: r.id, name: r.name, location: r.location, date: e.date, confirmed: e.confirmed, circuit: r.circuit || null, group: r.group })))
    .filter(r => r.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const data = {
    generatedAt: now.toISOString(),
    origin: ORIGIN.name,
    summary: generalState(rows, now),
    bulletinsAt: bulletins.fetchedAt || null,
    stations: out,
    races
  };
  await writeFile(new URL('data/widget.json', ROOT), `${JSON.stringify(data, null, 1)}\n`);
  console.log(`widget.json : ${out.length} stations · « ${data.summary} »`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
