/*
 * Onglet Courses : sélection de courses populaires de ski de fond (Jura,
 * Vosges, Alpes du Nord, Massif Central), à ajouter d'un geste au planning
 * de l'app Carnet. Chaque course propose deux éditions (en cours / suivante)
 * via le sélecteur d'année ; "Ajouter" envoie l'édition affichée.
 */
import { $, $$, esc } from '../core/utils.js';
import { readJSON, write } from '../services/storage.js';
import { addRaceToCarnet } from '../services/carnet-sync.js';
import { toast, toastError } from '../ui/toast.js';
import { icon } from '../ui/icons.js';
import { RACES, RACE_GROUPS } from '../data/races.js';

const ADDED_KEY = 'fondeur_races_added';
let added = new Set(readJSON(ADDED_KEY, []));
const saveAdded = () => write(ADDED_KEY, JSON.stringify([...added]));

const view = { group: 'all', yearIdx: 0 };

function addedKey(raceId, year) {
  return `${raceId}@${year}`;
}

function raceCard(r) {
  const edition = r.editions[view.yearIdx] || r.editions[0];
  const isAdded = added.has(addedKey(r.id, edition.year));
  return `<article class="race-card ${isAdded ? 'is-added' : ''}" data-race="${esc(r.id)}">
    <header class="race-card__head">
      <label class="race-card__check"><input type="checkbox" data-race-check ${isAdded ? 'disabled' : ''}></label>
      <div class="race-card__titles">
        <h3 class="race-card__name">${esc(r.name)}${r.circuit ? `<span class="race-card__circuit">${icon('flag', 11)}<span>${esc(r.circuit)}</span></span>` : ''}</h3>
        <p class="race-card__meta">${esc(r.location)}</p>
        <p class="race-card__period">${esc(r.period)}${edition.confirmed ? '' : ' · <em>à vérifier</em>'}</p>
      </div>
      <button type="button" class="race-card__mark ${isAdded ? 'is-on' : ''}" data-race-mark aria-pressed="${isAdded}" title="${isAdded ? 'Ajoutée au calendrier · toucher pour retirer la marque' : 'Marquer comme déjà ajoutée au calendrier (sans repasser par Carnet)'}">${icon(isAdded ? 'check' : 'calendar', 15)}</button>
    </header>
    <p class="race-card__dist">${esc(r.distance)}</p>
    ${r.notes ? `<p class="race-card__notes">${esc(r.notes)}</p>` : ''}
    <div class="race-card__actions">
      <input type="date" class="input race-card__date" data-race-date value="${esc(edition.date)}" aria-label="Date de l'édition ${edition.year} pour ${esc(r.name)}">
      <button type="button" class="btn btn--soft btn--sm" data-race-action="add" ${isAdded ? 'disabled' : ''}>${icon(isAdded ? 'check' : 'plus', 15)}<span>${isAdded ? 'Ajoutée ✓' : 'Ajouter'}</span></button>
      <a class="btn btn--ghost btn--sm" href="${esc(r.link)}" target="_blank" rel="noopener">Site officiel</a>
    </div>
  </article>`;
}

/** Marque/démarque manuellement une course comme « déjà ajoutée au calendrier », sans passer par Carnet. */
function toggleMark(card) {
  const id = card.dataset.race;
  const r = RACES.find(x => x.id === id);
  const edition = r.editions[view.yearIdx] || r.editions[0];
  const key = addedKey(id, edition.year);
  const now = !added.has(key);
  if (now) added.add(key);
  else added.delete(key);
  saveAdded();
  card.outerHTML = raceCard(r);
  updateBar();
  toast(now ? 'Marquée comme ajoutée au calendrier' : 'Marque retirée', { type: 'info' });
}

function updateBar() {
  const n = $$('#racesList [data-race-check]:checked').length;
  const bar = $('#racesBar');
  bar.hidden = n === 0;
  $('#racesBarCount').textContent = `${n} course${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
}

export function renderRaces() {
  const groupBtns = $$('#racesGroups [data-race-group]');
  if (groupBtns.length) groupBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.raceGroup === view.group)));
  const yearBtns = $$('#racesYear [data-race-year]');
  if (yearBtns.length) yearBtns.forEach((b, i) => b.setAttribute('aria-checked', String(i === view.yearIdx)));
  const filtered = view.group === 'all' ? RACES : view.group === 'circuit' ? RACES.filter(r => r.circuit) : RACES.filter(r => r.group === view.group);
  const editionDate = r => (r.editions[view.yearIdx] || r.editions[0]).date;
  const list = [...filtered].sort((a, b) => editionDate(a).localeCompare(editionDate(b)));
  $('#racesList').innerHTML = list.length ? list.map(raceCard).join('') : '<div class="empty">Aucune course dans cette catégorie.</div>';
  updateBar();
}

async function addOne(card, { silent = false } = {}) {
  const id = card.dataset.race;
  const r = RACES.find(x => x.id === id);
  const edition = r.editions[view.yearIdx] || r.editions[0];
  const date = card.querySelector('[data-race-date]').value;
  if (!date) {
    toastError(`Indiquez une date pour ${r.name}.`);
    return false;
  }
  try {
    // Carnet attend un nombre de km pour « distance » (plusieurs formats possibles ici) :
    // laissé vide pour que vous le précisiez une fois le format choisi.
    await addRaceToCarnet({ name: r.name, sport: 'Ski de fond', date, location: r.location });
    added.add(addedKey(id, edition.year));
    saveAdded();
    // Reflète tout de suite la marque « ajoutée » (badge + surbrillance du cadre), pas seulement le bouton.
    card.outerHTML = raceCard(r);
    if (!silent) toast(`${r.name} ajoutée au planning de Carnet`);
    return true;
  } catch (error) {
    if (!silent) toastError(`Carnet injoignable : ${error.message}`);
    return false;
  }
}

export function initRaces() {
  const groups = $('#racesGroups');
  if (groups) {
    groups.innerHTML = ['<button type="button" role="radio" data-race-group="all" aria-checked="true">Toutes</button>']
      .concat(RACE_GROUPS.map(g => `<button type="button" role="radio" data-race-group="${esc(g.id)}" aria-checked="false">${esc(g.label)}</button>`))
      .concat(['<button type="button" role="radio" data-race-group="circuit" aria-checked="false">🏁 Marathon Ski Tour</button>'])
      .join('');
    groups.addEventListener('click', e => {
      const b = e.target.closest('[data-race-group]');
      if (!b) return;
      view.group = b.dataset.raceGroup;
      renderRaces();
    });
  }
  const years = $('#racesYear');
  if (years) {
    years.addEventListener('click', e => {
      const b = e.target.closest('[data-race-year]');
      if (!b) return;
      view.yearIdx = Number(b.dataset.raceYear);
      renderRaces();
    });
  }
  $('#racesList').addEventListener('click', e => {
    const addBtn = e.target.closest('[data-race-action="add"]');
    if (addBtn) return addOne(addBtn.closest('[data-race]'));
    const markBtn = e.target.closest('[data-race-mark]');
    if (markBtn) toggleMark(markBtn.closest('[data-race]'));
  });
  $('#racesList').addEventListener('change', e => {
    if (e.target.matches('[data-race-check]')) updateBar();
  });
  $('#racesBarAdd').addEventListener('click', async () => {
    const cards = $$('#racesList [data-race-check]:checked').map(cb => cb.closest('[data-race]'));
    if (!cards.length) return;
    let ok = 0;
    for (const card of cards) {
      // eslint-disable-next-line no-await-in-loop
      if (await addOne(card, { silent: true })) ok++;
    }
    updateBar();
    if (ok) toast(`${ok} course${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''} au planning de Carnet`);
    if (ok < cards.length) toastError(`${cards.length - ok} course(s) n'ont pas pu être ajoutées.`);
  });
}
