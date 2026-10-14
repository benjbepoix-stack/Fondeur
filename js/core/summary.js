/*
 * Phrase d'état général du massif (« Bonne glisse ce matin, regel partout. »),
 * calculée sur toutes les stations, sans tenir compte des filtres.
 * Sans dépendance au navigateur : réutilisée par tools/build_widget.mjs.
 */

const median = arr => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const share = (arr, test) => (arr.length ? arr.filter(test).length / arr.length : 0);

/** @param list lignes { score, closed, depth, wx } ; @param now date de référence (heure locale) */
export function generalState(list, now = new Date()) {
  const ready = list.filter(r => r.score !== null && r.score !== undefined && r.wx);
  if (!ready.length) return '';
  const skiable = ready.filter(r => !r.closed && r.depth >= 5);
  if (!skiable.length) return 'Pas encore de neige skiable dans le massif.';
  if (skiable.length <= 3) return 'Peu de neige, peu de sites ouverts.';

  const when = now.getHours() < 11 ? 'ce matin' : 'aujourd’hui';
  const best = Math.max(...skiable.map(r => r.score));
  const glisse = best >= 80 ? 'Superbe glisse' : best >= 65 ? 'Bonne glisse' : best >= 50 ? 'Glisse correcte' : best >= 35 ? 'Glisse moyenne' : 'Glisse difficile';

  const regel = share(skiable, r => r.wx.tMinNight <= -2);
  const soft = median(skiable.map(r => r.wx.tMaxToday)) > 4;
  const rain = share(skiable, r => r.wx.rain48 > 2) >= 0.5;
  const fresh = share(skiable, r => r.wx.fresh24 >= 10) >= 0.5;

  if (rain) return `${glisse} ${when}, neige mouillée par la pluie.`;
  if (fresh) return `${glisse} ${when}, neige fraîche : attendre le damage.`;
  if (regel >= 0.75) return `${glisse} ${when}, regel partout${soft ? ', neige molle l’après-midi' : ''}.`;
  if (regel >= 0.35) return `${glisse} ${when}, regel par endroits${soft ? ', neige molle l’après-midi' : ''}.`;
  if (soft) return 'Redoux : neige molle l’après-midi.';
  return `${glisse} ${when}, peu de regel cette nuit.`;
}
