// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: snowflake;

/*
 * Glisse · widgets iPhone (app Scriptable, gratuite).
 *
 * Lit data/widget.json, recalculé par GitHub Actions avec le même calcul que
 * l'app (toutes les 30 min en saison). Toucher un widget ouvre la fiche de
 * la station (ou les courses) dans Glisse.
 *
 * Paramètre du widget (appui long sur le widget > Modifier le widget > Parameter) :
 *   (vide)                        petit : favoris (ou top 3) · moyen/grand : meilleur choix
 *   favoris: Chapelle, Mouthe     liste de favoris (noms ou débuts de noms, séparés par des virgules)
 *   station: Chapelle             meilleur choix forcé sur une station
 *   fart                          fart du jour (meilleur choix) · « fart: Mouthe » pour une station
 *   course                        prochaine course · « course: vosges » (jura, vosges, alpes-nord, massif-central)
 * Écran verrouillé (rond) : note (défaut), regel, fart. Rectangle et ligne : meilleur choix ou favoris.
 */

// ---------- Réglages ----------
const APP_URL = 'https://benjbepoix-stack.github.io/Fondeur/';
const DATA_URL = 'https://raw.githubusercontent.com/benjbepoix-stack/Fondeur/main/data/widget.json';
// Favoris par défaut quand le paramètre du widget est vide (ex. ['Chapelle', 'Mouthe', 'Brévine']).
const FAVORIS = [];

// ---------- Couleurs (clair / sombre) ----------
const dyn = (light, dark) => Color.dynamic(new Color(light), new Color(dark));
const C = {
  bg: dyn('#FFFFFF', '#131C2E'),
  text: dyn('#13202D', '#EEF3FB'),
  sub: dyn('#556372', '#AAB6C8'),
  line: dyn('#E3E8EE', '#223049'),
  chip: dyn('#EAF0F6', '#1B2740'),
  accent: dyn('#1E5FB4', '#8FD3FF'),
  good: dyn('#2E8F6A', '#6FD6A8'),
  mid: dyn('#B07D14', '#F0C46A'),
  bad: dyn('#C2554B', '#F08A7E')
};
const levelColor = l => C[l] || C.sub;
const VERDICT_SHORT = {
  'Excellentes conditions': 'Excellent',
  'Très bonnes conditions': 'Très bon',
  'Conditions correctes': 'Correct',
  'Conditions moyennes': 'Moyen',
  'Conditions médiocres': 'Médiocre',
  'Fermé selon le bulletin': 'Fermé',
  'Pas assez de neige': 'Pas de neige'
};

// ---------- Outils ----------
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const shortName = s => s.name.split(' · ')[0];
const deg = t => (t === null || t === undefined ? '—' : `${t > 0 ? '+' : ''}${Math.round(t)}°`.replace('-', '−'));
const travel = m => (m === null || m === undefined ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`);
const km = s => (s.kmTotal ? `${s.kmOpen}/${s.kmTotal} km` : `${s.alt} m`);
const waxLabel = s => (s.waxAm ? (s.waxPm && s.waxPm.name !== s.waxAm.name ? `${s.waxAm.name} → ${s.waxPm.name.toLowerCase()}` : s.waxAm.name) : '—');
const stationUrl = s => `${APP_URL}#station=${encodeURIComponent(s.id)}`;
const raceDate = r => {
  const d = new Date(`${r.date}T12:00:00`);
  return `${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}${r.confirmed ? '' : ' (à vérifier)'}`;
};

function findStation(data, query) {
  const q = norm(query);
  if (!q) return null;
  return data.stations.find(s => norm(s.id) === q) || data.stations.find(s => norm(s.name).startsWith(q)) || data.stations.find(s => norm(s.name).includes(q)) || null;
}

function parseParam(raw) {
  const text = String(raw || '').trim();
  const m = text.match(/^([a-zéèû]+)\s*:?\s*(.*)$/i);
  if (!m) return { mode: '', arg: '' };
  const mode = norm(m[1]);
  return ['favoris', 'favori', 'station', 'fart', 'course', 'courses', 'note', 'regel'].includes(mode) ? { mode: mode.replace(/s$/, ''), arg: m[2].trim() } : { mode: 'station', arg: text };
}

// ---------- Données (avec copie locale hors connexion) ----------
async function loadData() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), 'glisse-widget.json');
  try {
    const req = new Request(`${DATA_URL}?t=${Math.floor(Date.now() / 600000)}`);
    req.timeoutInterval = 15;
    const data = await req.loadJSON();
    if (!data || !Array.isArray(data.stations)) throw new Error('format');
    fm.writeString(path, JSON.stringify(data));
    return data;
  } catch (error) {
    if (fm.fileExists(path)) return JSON.parse(fm.readString(path));
    return null;
  }
}

function stamp(data) {
  const d = new Date(data.generatedAt);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
}

// ---------- Briques ----------
function text(parent, str, size, { weight = 'regular', color = C.text, mono = false, lines = 1, scale = 0.7 } = {}) {
  const t = parent.addText(str);
  const fonts = mono
    ? { regular: Font.regularMonospacedSystemFont, medium: Font.mediumMonospacedSystemFont, bold: Font.boldMonospacedSystemFont, heavy: Font.heavyMonospacedSystemFont }
    : { regular: Font.systemFont, medium: Font.mediumSystemFont, semibold: Font.semiboldSystemFont, bold: Font.boldSystemFont, heavy: Font.heavySystemFont };
  t.font = (fonts[weight] || fonts.regular)(size);
  t.textColor = color;
  t.lineLimit = lines;
  t.minimumScaleFactor = scale;
  return t;
}
const label = (parent, str, color = C.sub) => text(parent, str.toUpperCase(), 10, { mono: true, color });

function row(parent) {
  const s = parent.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  return s;
}

function chip(parent, str, bg, fg = C.text) {
  const c = parent.addStack();
  c.backgroundColor = bg;
  c.cornerRadius = 9;
  c.setPadding(4, 8, 4, 8);
  text(c, str, 11.5, { weight: 'semibold', color: fg });
  return c;
}

function newWidget(url) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 15, 14, 15);
  if (url) w.url = url;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  return w;
}

function errorWidget(message) {
  const w = newWidget(APP_URL);
  label(w, 'Glisse');
  w.addSpacer(6);
  text(w, message, 13, { color: C.sub, lines: 4 });
  return w;
}

// ---------- Widgets écran d'accueil ----------
/** Meilleur choix (moyen, grand) — avec « Ensuite » et la prochaine course en grand. */
function bestWidget(data, s, family) {
  const w = newWidget(stationUrl(s));
  const head = row(w);
  label(head, `Glisse · ${s === data.stations[0] ? 'meilleur choix' : 'station'}`);
  head.addSpacer();
  label(head, stamp(data));
  w.addSpacer(6);

  const main = row(w);
  main.bottomAlignContent();
  const left = main.addStack();
  left.layoutVertically();
  text(left, s.name, 22, { weight: 'heavy', lines: 1, scale: 0.6 });
  text(left, [travel(s.minutes), `${s.depth} cm`, km(s)].filter(Boolean).join(' · '), 12.5, { color: C.sub });
  main.addSpacer(8);
  text(main, String(s.score), 52, { weight: 'heavy', color: C.accent, scale: 0.8 });

  w.addSpacer(8);
  const chips = row(w);
  chips.spacing = 6;
  chip(chips, `${deg(s.tMin)} cette nuit`, C.chip);
  if (s.waxAm) chip(chips, `Fart ${s.waxAm.name.toLowerCase()}`, new Color(s.waxAm.color), Color.white());
  chip(chips, VERDICT_SHORT[s.verdict] || s.verdict, C.chip, levelColor(s.level));

  if (data.summary) {
    w.addSpacer(8);
    text(w, data.summary, family === 'large' ? 14 : 12, { weight: family === 'large' ? 'semibold' : 'regular', color: family === 'large' ? C.text : C.sub, lines: 2 });
  }

  if (family === 'large') {
    w.addSpacer(10);
    label(w, 'Ensuite');
    data.stations
      .filter(x => x.id !== s.id)
      .slice(0, 4)
      .forEach(x => {
        w.addSpacer(5);
        const r = row(w);
        r.url = stationUrl(x);
        text(r, shortName(x), 14, { weight: 'medium' });
        r.addSpacer();
        text(r, travel(x.minutes), 12, { mono: true, color: C.sub });
        r.addSpacer(10);
        text(r, String(x.score), 15, { weight: 'heavy', color: levelColor(x.level) });
      });
    const race = (data.races || [])[0];
    if (race) {
      w.addSpacer();
      const r = w.addStack();
      r.layoutVertically();
      r.url = `${APP_URL}#courses`;
      label(r, 'Prochaine course');
      text(r, `${race.name} · ${raceDate(race)}`, 13.5, { weight: 'bold' });
    }
  }
  return w;
}

/** Une station en petit : nom, note, regel et trajet. */
function smallBestWidget(data, s) {
  const w = newWidget(stationUrl(s));
  label(w, 'Glisse');
  w.addSpacer(4);
  text(w, s.name, 15, { weight: 'heavy', lines: 2, scale: 0.6 });
  w.addSpacer();
  text(w, String(s.score), 40, { weight: 'heavy', color: C.accent });
  text(w, VERDICT_SHORT[s.verdict] || s.verdict, 12, { weight: 'semibold', color: levelColor(s.level) });
  text(w, [`${deg(s.tMin)} la nuit`, travel(s.minutes)].filter(Boolean).join(' · '), 11, { color: C.sub, scale: 0.6 });
  return w;
}

/** Favoris ou top (petit, moyen, grand). */
function listWidget(data, list, title, family) {
  const w = newWidget(list[0] ? stationUrl(list[0]) : APP_URL);
  label(w, title);
  const max = family === 'small' ? 4 : family === 'medium' ? 4 : 9;
  list.slice(0, max).forEach(s => {
    w.addSpacer(family === 'small' ? 5 : 6);
    const r = row(w);
    r.url = stationUrl(s);
    text(r, shortName(s), family === 'small' ? 13 : 14, { weight: 'medium' });
    r.addSpacer();
    if (family !== 'small') {
      text(r, `${deg(s.tMin)} · ${travel(s.minutes)}`, 12, { mono: true, color: C.sub });
      r.addSpacer(10);
    }
    text(r, String(s.score), family === 'small' ? 14 : 15, { weight: 'heavy', color: levelColor(s.level) });
  });
  if (!list.length) {
    w.addSpacer(6);
    text(w, 'Aucune station trouvée : vérifiez les noms du paramètre.', 12, { color: C.sub, lines: 3 });
  }
  w.addSpacer();
  if (family !== 'small' && data.summary) text(w, data.summary, 11.5, { color: C.sub, lines: 1 });
  return w;
}

/** Fart du jour (petit). */
function waxWidget(data, s) {
  const w = newWidget(stationUrl(s));
  label(w, `Fart · ${shortName(s)}`);
  w.addSpacer(8);
  const bars = row(w);
  bars.spacing = 6;
  [s.waxAm, s.waxPm].forEach(x => {
    const b = bars.addStack();
    b.size = new Size(0, 40);
    b.cornerRadius = 10;
    b.backgroundColor = x ? new Color(x.color) : C.chip;
    b.addSpacer();
  });
  w.addSpacer(8);
  text(w, waxLabel(s), 13, { weight: 'semibold', lines: 2 });
  text(w, `matin ${deg(s.tMin)} · après-midi ${deg(s.tMax)}`, 11, { color: C.sub, scale: 0.6 });
  w.addSpacer();
  return w;
}

/** Prochaine course (moyen, en bandeau). */
function raceWidget(data, group) {
  const w = newWidget(`${APP_URL}#courses`);
  const races = (data.races || []).filter(r => !group || norm(r.group) === norm(group) || norm(r.location).includes(norm(group)));
  const race = races[0];
  label(w, 'Prochaine course');
  w.addSpacer(4);
  if (!race) {
    text(w, 'Aucune course à venir dans la sélection.', 14, { color: C.sub, lines: 2 });
    return w;
  }
  text(w, race.name, 18, { weight: 'heavy', lines: 1 });
  text(w, `${raceDate(race)} · ${race.location}`, 13, { color: C.sub, lines: 1 });
  if (race.circuit) {
    w.addSpacer(4);
    label(w, race.circuit, C.accent);
  }
  const next = races.slice(1, 3);
  if (next.length) {
    w.addSpacer();
    text(w, `Puis ${next.map(r => `${r.name} (${raceDate(r).replace(' (à vérifier)', ' ?')})`).join(' · ')}`, 11.5, { color: C.sub, lines: 1 });
  }
  return w;
}

// ---------- Écran verrouillé ----------
function circularWidget(data, s, mode) {
  const w = new ListWidget();
  w.addAccessoryWidgetBackground = true;
  w.url = stationUrl(s);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  const value = mode === 'regel' ? deg(s.tMin) : mode === 'fart' ? (s.waxAm ? s.waxAm.name.split(' ')[0] : '—') : String(s.score);
  const caption = mode === 'regel' ? 'regel' : mode === 'fart' ? 'fart' : 'note';
  const top = row(w);
  top.addSpacer();
  text(top, value, mode === 'fart' ? 13 : 22, { weight: 'heavy', color: Color.white(), scale: 0.5 });
  top.addSpacer();
  const bottom = row(w);
  bottom.addSpacer();
  text(bottom, caption, 9, { color: Color.white() });
  bottom.addSpacer();
  return w;
}

function rectangularWidget(data, s, list) {
  const w = new ListWidget();
  w.url = stationUrl(s);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  text(w, `Glisse · depuis ${data.origin}`, 11, { color: Color.white() });
  text(w, `${shortName(s)} ${s.score} · ${travel(s.minutes)}`, 14, { weight: 'bold', color: Color.white() });
  text(w, list.filter(x => x.id !== s.id).slice(0, 2).map(x => `${shortName(x)} ${x.score}`).join(' · ') || data.summary, 11.5, { color: Color.white(), scale: 0.6 });
  return w;
}

function inlineWidget(data, s) {
  const w = new ListWidget();
  w.url = stationUrl(s);
  w.addText(`${shortName(s)} ${s.score} · ${deg(s.tMin)} · fart ${s.waxAm ? s.waxAm.name.toLowerCase() : '—'}`);
  return w;
}

// ---------- Choix du widget ----------
async function build(family, rawParam) {
  const data = await loadData();
  if (!data || !data.stations.length) return errorWidget('Données indisponibles pour le moment. Elles reviennent à la prochaine relève des bulletins.');
  const { mode, arg } = parseParam(rawParam);
  const best = data.stations[0];
  const favNames = mode === 'favori' ? arg.split(',') : FAVORIS;
  const favs = favNames.map(n => findStation(data, n)).filter(Boolean);
  const target = (mode === 'station' || mode === 'fart' || mode === 'note' || mode === 'regel') && arg ? findStation(data, arg) || best : best;

  if (family === 'accessoryCircular') return circularWidget(data, mode === 'favori' && favs[0] ? favs[0] : target, mode === 'favori' ? 'note' : mode);
  if (family === 'accessoryRectangular') return rectangularWidget(data, mode === 'favori' && favs.length ? favs[0] : target, mode === 'favori' && favs.length ? favs : data.stations);
  if (family === 'accessoryInline') return inlineWidget(data, mode === 'favori' && favs.length ? favs[0] : target);

  if (mode === 'course') return raceWidget(data, arg);
  if (mode === 'fart') return waxWidget(data, target);
  if (mode === 'favori' || (family === 'small' && !mode && favs.length)) return listWidget(data, favs.sort((a, b) => b.score - a.score), '★ Favoris', family);
  if (family === 'small' && mode !== 'station') return listWidget(data, data.stations.slice(0, 4), 'Glisse · top', family);
  if (family === 'small') return smallBestWidget(data, target);
  return bestWidget(data, target, family === 'large' || family === 'extraLarge' ? 'large' : 'medium');
}

const family = config.widgetFamily || 'large';
const widget = await build(family, args.widgetParameter);
if (config.runsInWidget) Script.setWidget(widget);
else await widget.presentLarge();
Script.complete();
