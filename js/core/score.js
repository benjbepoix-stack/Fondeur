/*
 * Note « skating » sur 100, expliquée facteur par facteur.
 *
 * Le skating demande une neige damée, ferme et regelée :
 *  - Neige (35)      : épaisseur suffisante pour damer (mesurée par la station si le
 *                      bulletin est à jour, sinon estimée par le modèle météo).
 *  - Pistes (20)     : part des km ouverts selon le bulletin.
 *  - Regel (15)      : minimum de la nuit ; une nuit froide donne une neige dure et rapide.
 *  - Journée (10)    : maximum du jour ; au-delà de +4 °C la neige ramollit.
 *  - Damage (10)     : damage récent (aujourd'hui ou hier).
 *  - Météo (10)      : pas de pluie sur 48 h, vent modéré.
 *  - Malus           : grosse chute de neige non damée (défavorable au skating).
 * Le trajet n'entre pas dans la note : il est seulement affiché.
 */
import { todayKey, fromKey } from './dates.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (x, x0, x1) => clamp((x - x0) / (x1 - x0));
const daysAgo = iso => (iso ? Math.round((fromKey(todayKey()) - fromKey(iso)) / 86400000) : null);

/** Bulletin normalisé et « frais » (mis à jour depuis moins de 4 jours). */
export function bulletinFor(station, bulletins) {
  if (!bulletins) return null;
  if (station.country === 'FR') {
    const b = bulletins.france?.[station.nf];
    if (!b || b.error) return null;
    const age = daysAgo(b.updated);
    return { ...b, source: 'fr', live: age !== null && age <= 3, age };
  }
  const b = station.ch ? bulletins.suisse?.[station.ch] : null;
  if (!b) return null;
  return { ...b, source: 'ch', live: !b.noSeason && (b.kmOpen !== null || b.snow !== null) };
}

export function computeScore(wx, b) {
  const factors = [];
  const add = (key, label, pts, max, note) => factors.push({ key, label, pts: Math.round(pts), max, note });
  if (!wx) return { score: null, factors, verdict: 'Météo indisponible', level: 'unknown' };

  // 1. Neige
  const measured = b?.live && b.snowMax !== null && b.snowMax !== undefined ? (Number(b.snowMin || 0) + Number(b.snowMax)) / 2 : b?.live && b.snow ? b.snow : null;
  const depth = measured ?? wx.depth ?? 0;
  add('snow', 'Épaisseur de neige', 35 * lerp(depth, 5, 40), 35, measured !== null ? `${Math.round(depth)} cm mesurés par la station` : `${Math.round(depth)} cm estimés (modèle météo)`);

  // 2. Pistes ouvertes
  let closed = false;
  if (b?.live && b.kmTotal) {
    const ratio = clamp((b.kmOpen || 0) / b.kmTotal);
    closed = (b.kmOpen || 0) === 0 && !b.open;
    add('open', 'Pistes ouvertes', 20 * Math.sqrt(ratio), 20, `${Math.round(b.kmOpen || 0)} / ${Math.round(b.kmTotal)} km`);
  } else {
    add('open', 'Pistes ouvertes', 10 * lerp(depth, 10, 35), 20, 'Pas de bulletin du jour : estimé d’après la neige');
  }

  // 3. Regel nocturne
  const tmin = wx.tMinNight;
  add('night', 'Regel de la nuit', 15 * lerp(-tmin, -1, 6), 15, `${fmt(tmin)} cette nuit${tmin <= -4 ? ' : neige dure le matin' : tmin > 0 ? ' : pas de regel' : ''}`);

  // 4. Température de la journée
  const tmax = wx.tMaxToday;
  add('day', 'Température du jour', 10 * (1 - lerp(tmax, 0, 8)), 10, `${fmt(tmax)} au plus chaud${tmax > 4 ? ' : neige qui ramollit' : ''}`);

  // 5. Damage récent
  const groomAge = b?.live ? daysAgo(b.lastGrooming) : null;
  const groom = groomAge === null ? (b?.live ? 2 : 4) : groomAge <= 1 ? 10 : groomAge === 2 ? 6 : groomAge <= 4 ? 3 : 0;
  add('groom', 'Damage', groom, 10, groomAge === null ? (b?.live ? 'Date de damage non indiquée' : 'Inconnu (pas de bulletin du jour)') : groomAge === 0 ? 'Damé aujourd’hui' : groomAge === 1 ? 'Damé hier' : `Damé il y a ${groomAge} jours`);

  // 6. Météo : pluie et vent
  const rainPenalty = lerp(wx.rain48, 0.5, 8) * 8;
  const windPenalty = lerp(wx.windMax, 30, 60) * 2;
  add('weather', 'Pluie et vent', 10 - rainPenalty - windPenalty, 10, `${wx.rain48 > 0.4 ? `${String(wx.rain48).replace('.', ',')} mm de pluie sur 48 h` : 'Pas de pluie sur 48 h'} · vent ${Math.round(wx.windMax)} km/h`);

  // Malus : neige fraîche abondante non damée
  if (wx.fresh24 >= 12 && !(groomAge !== null && groomAge <= 0)) add('fresh', 'Neige fraîche non damée', -6, 0, `+${wx.fresh24} cm en 24 h : attendre le damage pour le skating`);

  let score = clamp(factors.reduce((s, f) => s + f.pts, 0) / 100) * 100;
  if (closed) score = Math.min(score, 15);
  if (depth < 5) score = Math.min(score, 10);
  score = Math.round(score);

  let verdict;
  let level;
  if (closed) [verdict, level] = ['Fermé selon le bulletin', 'bad'];
  else if (depth < 5) [verdict, level] = ['Pas assez de neige', 'bad'];
  else if (score >= 80) [verdict, level] = ['Excellentes conditions', 'good'];
  else if (score >= 65) [verdict, level] = ['Très bonnes conditions', 'good'];
  else if (score >= 50) [verdict, level] = ['Conditions correctes', 'mid'];
  else if (score >= 35) [verdict, level] = ['Conditions moyennes', 'mid'];
  else [verdict, level] = ['Conditions médiocres', 'bad'];
  return { score, factors, verdict, level, depth: Math.round(depth), measured: measured !== null, closed };
}

export const levelOf = score => (score === null ? 'unknown' : score >= 65 ? 'good' : score >= 35 ? 'mid' : 'bad');
const fmt = t => (t === null || t === undefined ? '—' : `${t > 0 ? '+' : ''}${Math.round(t)} °C`.replace('-', '−'));
export { fmt as fmtTemp };
