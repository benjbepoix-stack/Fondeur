/* Fondeur — point d'entrée : chargement des données, départ, filtres, rendu. */
import { $, $$, esc, uid, parseNumber } from './core/utils.js';
import { readJSON, readText, write } from './services/storage.js';
import { loadWeather } from './services/weather.js';
import { loadRoutes } from './services/routes.js';
import { searchPlace } from './services/geocode.js';
import { bulletinFor, computeScore } from './core/score.js';
import { isFavorite, toggleFavorite, rankScore, restoreFavorites } from './core/favorites.js';
import { initDialogs, openSheet, closeSheet, confirmDialog } from './ui/dialog.js';
import { applyTheme } from './ui/theme.js';
import { toast, toastError } from './ui/toast.js';
import { icon } from './ui/icons.js';
import { renderList } from './views/list.js';
import { setFavButton } from './views/common.js';
import { openStation, initStation } from './views/station.js';
import { renderMap } from './views/map.js';
import { renderRaces, initRaces } from './views/races.js';

/* ---------- Lieux de départ (éditables, « Ici » mis à part) ---------- */
const PLACES_KEY = 'fondeur_places';
const DEFAULT_PLACES = [
  { id: 'villedupont', name: 'Ville-du-Pont', lat: 46.999, lon: 6.4989 },
  { id: 'boussieres', name: 'Boussières', lat: 47.158, lon: 5.894 }
];
function loadPlaces() {
  const saved = readJSON(PLACES_KEY, null);
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_PLACES.map(p => ({ ...p }));
}
const savePlaces = () => write(PLACES_KEY, JSON.stringify(state.places));
const placeById = id => state.places.find(p => p.id === id);

const PREFS = 'fondeur_prefs';

const state = {
  stations: [],
  bulletins: null,
  weather: {},
  weatherAt: null,
  routes: {},
  origin: null,
  places: loadPlaces(),
  prefs: { origin: 'villedupont', view: 'list', country: 'all', travel: 0, sort: 'score', ...readJSON(PREFS, {}) }
};
// Ancien point de départ (Besançon) remplacé par Boussières
if (state.prefs.origin === 'besancon') state.prefs.origin = 'boussieres';
// L'app doit toujours rouvrir sur « Où skier ? », jamais rester sur l'onglet
// Courses resté ouvert à la fermeture précédente (le choix de vue n'est donc
// plus persisté d'une session à l'autre, même s'il continue de l'être le
// temps de la session, pour les autres écrans qui s'y réfèrent).
state.prefs.view = 'list';

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

const PAGE_TITLES = { list: 'Où skier aujourd’hui ?', map: 'Où skier aujourd’hui ?', races: 'Courses' };

function render() {
  const list = rows();
  const view = state.prefs.view;
  document.body.dataset.view = view;
  $$('#viewSwitch [data-view]').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('is-active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  $('#listView').hidden = view !== 'list';
  $('#mapView').hidden = view !== 'map';
  $('#racesView').hidden = view !== 'races';
  $('#pageTitle').textContent = PAGE_TITLES[view] || PAGE_TITLES.list;
  $('.origin-row').hidden = view === 'races';
  $('.toolbar').hidden = view === 'races';
  $('#statusLine').hidden = view === 'races';
  if (view === 'list') renderList(list, state);
  else if (view === 'map') renderMap(list, state);
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

/** (Re)construit les boutons de lieux de départ à partir de state.places, « Ici » (GPS) toujours en dernier. */
function renderOriginSwitch() {
  const html =
    state.places.map(p => `<label><input type="radio" name="origin" value="${esc(p.id)}"><span>${esc(p.name)}</span></label>`).join('') +
    `<label><input type="radio" name="origin" value="gps"><span>📍 Ici</span></label>`;
  $('#originSwitch').innerHTML = html;
  const current = $(`#originSwitch input[value="${state.prefs.origin}"]`) || $(`#originSwitch input[value="gps"]`);
  if (current) current.checked = true;
}

async function setOrigin(key) {
  let origin = placeById(key);
  if (key === 'gps') {
    try {
      origin = await gpsPosition();
      write('fondeur_last_gps', JSON.stringify(origin));
    } catch (error) {
      const last = readJSON('fondeur_last_gps', null);
      if (!last) {
        toastError(error.message);
        const fallback = state.prefs.origin !== 'gps' && placeById(state.prefs.origin) ? state.prefs.origin : state.places[0]?.id || 'gps';
        $(`#originSwitch input[value="${fallback}"]`).checked = true;
        return;
      }
      origin = last;
      toast('Dernière position connue utilisée', { type: 'info' });
    }
  }
  if (!origin) return;
  state.origin = origin;
  state.prefs.origin = key;
  savePrefs();
  render();
  state.routes = await loadRoutes(origin, state.stations);
  render();
}

/* ---------- Gestion des lieux de départ ---------- */
function renderPlacesList() {
  $('#placesList').innerHTML = state.places.length
    ? state.places
        .map(
          p => `<div class="row" data-place="${esc(p.id)}">
            <div class="row__body"><span class="row__title">${esc(p.name)}</span><span class="row__sub">${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}</span></div>
            <div class="row-actions">
              <button type="button" class="icon-btn icon-btn--sm" data-place-edit aria-label="Modifier ${esc(p.name)}"><span data-icon="edit" data-size="16"></span></button>
              <button type="button" class="icon-btn icon-btn--sm icon-btn--danger" data-place-delete aria-label="Supprimer ${esc(p.name)}"><span data-icon="trash" data-size="16"></span></button>
            </div>
          </div>`
        )
        .join('')
    : '<p class="field__help">Aucun lieu enregistré pour l’instant.</p>';
}

function openPlaces() {
  renderPlacesList();
  openSheet('placesSheet', { focus: false });
}

function fillPlaceGps() {
  gpsPosition()
    .then(pos => {
      $('#placeForm').elements.lat.value = pos.lat.toFixed(5);
      $('#placeForm').elements.lon.value = pos.lon.toFixed(5);
      $('#placeFormError').hidden = true;
    })
    .catch(error => toastError(error.message));
}

function openPlaceForm(id = null) {
  const p = id ? placeById(id) : null;
  const form = $('#placeForm');
  form.reset();
  $('#placeFormError').hidden = true;
  form.elements.editId.value = p ? p.id : '';
  form.elements.name.value = p?.name || '';
  form.elements.lat.value = p ? String(p.lat).replace('.', ',') : '';
  form.elements.lon.value = p ? String(p.lon).replace('.', ',') : '';
  $('#plSearch').value = '';
  $('#plSearchResults').innerHTML = '';
  $('#placeFormTitle').textContent = p ? `Modifier · ${p.name}` : 'Nouveau lieu';
  $('#placeDeleteBtn').hidden = !p;
  openSheet('placeFormSheet', { focus: false });
}

/* ---------- Recherche de commune (remplit nom + coordonnées d'un coup) ---------- */
let placeSearchResults = [];
let placeSearchTimer = null;

function renderPlaceSearchResults() {
  $('#plSearchResults').innerHTML = placeSearchResults
    .map(
      (r, i) =>
        `<button type="button" class="row" data-pick="${i}">
          <span class="row__icon">${icon('pin', 16)}</span>
          <div class="row__body"><span class="row__title">${esc(r.name)}</span>${r.detail ? `<span class="row__sub">${esc(r.detail)}</span>` : ''}</div>
        </button>`
    )
    .join('');
}

function onPlaceSearchInput(e) {
  const q = e.target.value;
  clearTimeout(placeSearchTimer);
  if (q.trim().length < 2) {
    placeSearchResults = [];
    $('#plSearchResults').innerHTML = '';
    return;
  }
  placeSearchTimer = setTimeout(async () => {
    try {
      placeSearchResults = await searchPlace(q);
      renderPlaceSearchResults();
    } catch {
      // Recherche indisponible (hors ligne…) : on laisse la saisie manuelle.
    }
  }, 350);
}

function pickPlaceSearchResult(i) {
  const r = placeSearchResults[i];
  if (!r) return;
  const form = $('#placeForm');
  form.elements.name.value = r.name;
  form.elements.lat.value = String(r.lat).replace('.', ',');
  form.elements.lon.value = String(r.lon).replace('.', ',');
  $('#placeFormError').hidden = true;
  $('#plSearch').value = '';
  placeSearchResults = [];
  $('#plSearchResults').innerHTML = '';
  toast(`${r.name} sélectionnée`, { type: 'info' });
}

function onPlaceSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const name = form.elements.name.value.trim();
  const lat = parseNumber(form.elements.lat.value);
  const lon = parseNumber(form.elements.lon.value);
  const errBox = $('#placeFormError');
  const err = !name ? 'Indiquez un nom.' : lat === null || lat < -90 || lat > 90 ? 'Latitude invalide.' : lon === null || lon < -180 || lon > 180 ? 'Longitude invalide.' : null;
  if (err) {
    errBox.textContent = err;
    errBox.hidden = false;
    return;
  }
  const editId = form.elements.editId.value;
  const item = { id: editId || uid(), name, lat, lon };
  state.places = editId ? state.places.map(p => (p.id === editId ? item : p)) : [...state.places, item];
  savePlaces();
  closeSheet('placeFormSheet');
  renderPlacesList();
  renderOriginSwitch();
  toast(editId ? 'Lieu modifié' : 'Lieu ajouté');
  // Si le lieu actif a été renommé/déplacé, reprend ses nouvelles coordonnées tout de suite.
  if (state.prefs.origin === item.id) setOrigin(item.id);
}

async function deletePlace(id) {
  const p = placeById(id);
  if (!p || !(await confirmDialog({ title: `Supprimer « ${p.name} » ?`, confirmLabel: 'Supprimer', danger: true }))) return;
  state.places = state.places.filter(x => x.id !== id);
  savePlaces();
  closeSheet('placeFormSheet');
  renderPlacesList();
  renderOriginSwitch();
  toast('Lieu supprimé');
  if (state.prefs.origin === id) setOrigin(state.places[0]?.id || 'gps');
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
  renderOriginSwitch();
  $('#originSwitch').addEventListener('change', e => setOrigin(e.target.value));
  $('#placesEditBtn').addEventListener('click', openPlaces);
  $('#placesList').addEventListener('click', e => {
    const row = e.target.closest('[data-place]');
    if (!row) return;
    if (e.target.closest('[data-place-delete]')) return deletePlace(row.dataset.place);
    openPlaceForm(row.dataset.place);
  });
  $('#placeAddBtn').addEventListener('click', () => openPlaceForm());
  $('#placeForm').addEventListener('submit', onPlaceSubmit);
  $('#placeDeleteBtn').addEventListener('click', () => deletePlace($('#placeForm').elements.editId.value));
  $('#placeUseGps').addEventListener('click', fillPlaceGps);
  $('#plSearch').addEventListener('input', onPlaceSearchInput);
  $('#plSearchResults').addEventListener('click', e => {
    const btn = e.target.closest('[data-pick]');
    if (btn) pickPlaceSearchResult(Number(btn.dataset.pick));
  });
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
  const originKey = placeById(state.prefs.origin) || state.prefs.origin === 'gps' ? state.prefs.origin : state.places[0]?.id || 'gps';
  const originInput = $(`#originSwitch input[value="${originKey}"]`);
  if (originInput) originInput.checked = true;
  state.origin = placeById(originKey) || readJSON('fondeur_last_gps', state.places[0]);
  render();
  await Promise.all([loadData(), setOrigin(originKey)]);

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();
