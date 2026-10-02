/* Fondeur — point d'entrée : chargement des données, départ, filtres, rendu. */
import { $, $$ } from './core/utils.js';
import { readJSON, readText, write } from './services/storage.js';
import { loadWeather } from './services/weather.js';
import { loadRoutes } from './services/routes.js';
import { bulletinFor, computeScore } from './core/score.js';
import { isFavorite, toggleFavorite, rankScore, restoreFavorites } from './core/favorites.js';
import { initDialogs } from './ui/dialog.js';
import { applyTheme } from './ui/theme.js';
import { toast, toastError } from './ui/toast.js';
import { icon } from './ui/icons.js';
import { renderList } from './views/list.js';
import { setFavButton } from './views/common.js';
import { openStation, initStation } from './views/station.js';
import { renderMap } from './views/map.js';
import { renderRaces, initRaces } from './views/races.js';

export const PLACES = {
  villedupont: { name: 'Ville-du-Pont', lat: 46.999, lon: 6.4989 },
  boussieres: { name: 'Boussières', lat: 47.158, lon: 5.894 }
};
const PREFS = 'fondeur_prefs';

const state = {
  stations: [],
  bulletins: null,
  weather: {},
  weatherAt: null,
  routes: {},
  origin: null,
  prefs: { origin: 'villedupont', view: 'list', country: 'all', travel: 0, sort: 'score', ...readJSON(PREFS, {}) }
};
// Ancien point de départ (Besançon) remplacé par Boussières
if (state.prefs.origin === 'besancon') state.prefs.origin = 'boussieres';

const savePrefs = () => write(PREFS, JSON.stringify(state.prefs));

/**
 * Lignes du classement. Par défaut, triées par note ; à niveau égal (écart
 * ≤ 3 points), les favoris passent devant, puis le trajet le plus court.
 * Deux autres tris sont disponibles (state.prefs.sort) : par trajet le plus
 * court, ou par nuit la plus froide (meilleur regel) — la note reste le
 * critère de repli en cas d'égalité pour ces deux modes.
 */
const byDefault = (a, b) =>
  rankScore(b.score, b.station.id) - rankScore(a.score, a.station.id) ||
  Number(b.fav) - Number(a.fav) ||
  (b.score ?? -1) - (a.score ?? -1) ||
  (a.route?.minutes ?? 999) - (b.route?.minutes ?? 999);

export function rows() {
  return state.stations
    .map(s => {
      const b = bulletinFor(s, state.bulletins);
      const wx = state.weather[s.id] || null;
      return { station: s, bulletin: b, wx, route: state.routes[s.id] || null, fav: isFavorite(s.id), ...computeScore(wx, b) };
    })
    .filter(r => state.prefs.country === 'all' || (state.prefs.country === 'fav' ? r.fav : r.station.country === state.prefs.country))
    .filter(r => !state.prefs.travel || !r.route || r.route.minutes <= state.prefs.travel)
    .sort((a, b) => {
      if (state.prefs.sort === 'distance') {
        const da = a.route?.minutes ?? Infinity;
        const db = b.route?.minutes ?? Infinity;
        if (da !== db) return da - db;
      } else if (state.prefs.sort === 'night') {
        const ta = a.wx?.tMinNight ?? Infinity;
        const tb = b.wx?.tMinNight ?? Infinity;
        if (ta !== tb) return ta - tb;
      }
      return byDefault(a, b);
    });
}

export const getState = () => state;

function render() {
  const list = rows();
  $$('#viewSwitch [data-view]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === state.prefs.view)));
  $('#listView').hidden = state.prefs.view !== 'list';
  $('#mapView').hidden = state.prefs.view !== 'map';
  $('#racesView').hidden = state.prefs.view !== 'races';
  if (state.prefs.view === 'list') renderList(list, state);
  else if (state.prefs.view === 'map') renderMap(list, state);
  else renderRaces();
  const at = state.weatherAt ? new Date(state.weatherAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
  const fetched = state.bulletins?.fetchedAt ? new Date(state.bulletins.fetchedAt) : null;
  $('#statusLine').textContent = [
    state.origin ? `Départ : ${state.origin.name}` : '',
    at ? `météo ${at}` : '',
    fetched ? `bulletins relevés le ${fetched.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${fetched.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''
  ]
    .filter(Boolean)
    .join(' · ');
}

/* ---------- Départ ---------- */
function gpsPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Géolocalisation indisponible.'));
    navigator.geolocation.getCurrentPosition(
      p => resolve({ name: 'ma position', lat: p.coords.latitude, lon: p.coords.longitude }),
      () => reject(new Error('Position refusée ou indisponible.')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

async function setOrigin(key) {
  let origin = PLACES[key];
  if (key === 'gps') {
    try {
      origin = await gpsPosition();
      write('fondeur_last_gps', JSON.stringify(origin));
    } catch (error) {
      const last = readJSON('fondeur_last_gps', null);
      if (!last) {
        toastError(error.message);
        $(`#originSwitch input[value="${state.prefs.origin === 'gps' ? 'villedupont' : state.prefs.origin}"]`).checked = true;
        return;
      }
      origin = last;
      toast('Dernière position connue utilisée', { type: 'info' });
    }
  }
  state.origin = origin;
  state.prefs.origin = key;
  savePrefs();
  render();
  state.routes = await loadRoutes(origin, state.stations);
  render();
}

/* ---------- Données ---------- */
async function loadData({ force = false } = {}) {
  const btn = $('#refreshBtn');
  btn.classList.add('is-spinning');
  try {
    const [bulletins, weather] = await Promise.all([
      fetch(`data/bulletins.json?t=${Math.floor(Date.now() / 60000)}`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null),
      loadWeather(state.stations, { force }).catch(error => {
        toastError(`${error.message}. Nouvel essai dans un instant.`);
        return null;
      })
    ]);
    if (bulletins) state.bulletins = bulletins;
    if (weather) {
      state.weather = weather.data;
      state.weatherAt = weather.at;
    }
    render();
  } finally {
    btn.classList.remove('is-spinning');
  }
}

async function init() {
  $$('[data-icon]').forEach(el => (el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22)));
  applyTheme(readText('fondeur_theme', '"light"').includes('dark') ? 'dark' : 'light');
  initDialogs();
  initStation();
  initRaces();

  $('#themeToggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    write('fondeur_theme', JSON.stringify(next));
    applyTheme(next, { animate: true });
    if (state.prefs.view === 'map') render();
  });
  $('#refreshBtn').addEventListener('click', () => loadData({ force: true }));
  $('#originSwitch').addEventListener('change', e => setOrigin(e.target.value));
  $('#viewSwitch').addEventListener('click', e => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    state.prefs.view = b.dataset.view;
    savePrefs();
    render();
  });
  $('#countryFilter').value = state.prefs.country;
  $('#travelFilter').value = String(state.prefs.travel);
  $('#countryFilter').addEventListener('change', e => {
    state.prefs.country = e.target.value;
    savePrefs();
    render();
  });
  $('#travelFilter').addEventListener('change', e => {
    state.prefs.travel = Number(e.target.value);
    savePrefs();
    render();
  });
  $('#sortFilter').value = state.prefs.sort;
  $('#sortFilter').addEventListener('change', e => {
    state.prefs.sort = e.target.value;
    savePrefs();
    render();
  });
  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) {
      const on = toggleFavorite(fav.dataset.fav);
      document.querySelectorAll(`[data-fav="${fav.dataset.fav}"]`).forEach(b => setFavButton(b, on));
      toast(on ? 'Ajoutée aux favoris ★' : 'Retirée des favoris', { type: 'info' });
      render();
      return;
    }
    const s = e.target.closest('[data-station]');
    if (s && !e.target.closest('a')) openStation(s.dataset.station);
  });
  document.addEventListener('keydown', e => {
    const s = e.target.closest?.('.rank-row[data-station]');
    if (s && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openStation(s.dataset.station);
    }
  });
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && loadData());

  restoreFavorites().then(restored => restored && render());
  const data = await fetch('data/stations.json').then(r => r.json());
  state.stations = data.stations;
  state.webcamsPage = data.webcamsPage;
  const originKey = PLACES[state.prefs.origin] || state.prefs.origin === 'gps' ? state.prefs.origin : 'villedupont';
  $(`#originSwitch input[value="${originKey}"]`).checked = true;
  state.origin = PLACES[originKey] || readJSON('fondeur_last_gps', PLACES.villedupont);
  render();
  await Promise.all([loadData(), setOrigin(originKey)]);

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
