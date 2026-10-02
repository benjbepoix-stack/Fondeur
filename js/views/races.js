/*
 * Onglet Courses : sélection de courses populaires de ski de fond du Massif
 * du Jura, à ajouter d'un geste au planning de course de l'app Carnet.
 */
import { $, $$, esc } from '../core/utils.js';
import { readJSON, write } from '../services/storage.js';
import { addRaceToCarnet } from '../services/carnet-sync.js';
import { toast, toastError } from '../ui/toast.js';
import { icon } from '../ui/icons.js';
import { RACES } from '../data/races.js';

const ADDED_KEY = 'fondeur_races_added';
let added = new Set(readJSON(ADDED_KEY, []));
const saveAdded = () => write(ADDED_KEY, JSON.stringify([...added]));

function raceCard(r) {
  const isAdded = added.has(r.id);
  return `<article class="race-card" data-race="${esc(r.id)}">
    <header class="race-card__head">
      <label class="race-card__check"><input type="checkbox" data-race-check ${isAdded ? 'disabled' : ''}></label>
      <div class="race-card__titles">
        <h3 class="race-card__name">${esc(r.name)}</h3>
        <p class="race-card__meta">${esc(r.location)}</p>
        <p class="race-card__period">${esc(r.period)}${r.confirmed ? '' : ' · <em>à vérifier</em>'}</p>
      </div>
    </header>
    <p class="race-card__dist">${esc(r.distance)}</p>
    ${r.notes ? `<p class="race-card__notes">${esc(r.notes)}</p>` : ''}
    <div class="race-card__actions">
      <input type="date" class="input race-card__date" data-race-date value="${esc(r.date)}" aria-label="Date de l'édition pour ${esc(r.name)}">
      <button type="button" class="btn btn--soft btn--sm" data-race-action="add" ${isAdded ? 'disabled' : ''}>${icon(isAdded ? 'check' : 'plus', 15)}<span>${isAdded ? 'Ajoutée ✓' : 'Ajouter'}</span></button>
      <a class="btn btn--ghost btn--sm" href="${esc(r.link)}" target="_blank" rel="noopener">Site officiel</a>
    </div>
  </article>`;
}

function updateBar() {
  const n = $$('#racesList [data-race-check]:checked').length;
  const bar = $('#racesBar');
  bar.hidden = n === 0;
  $('#racesBarCount').textContent = `${n} course${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}`;
}

export function renderRaces() {
  $('#racesList').innerHTML = RACES.map(raceCard).join('');
  updateBar();
}

async function addOne(card, { silent = false } = {}) {
  const id = card.dataset.race;
  const r = RACES.find(x => x.id === id);
  const date = card.querySelector('[data-race-date]').value;
  if (!date) {
    toastError(`Indiquez une date pour ${r.name}.`);
    return false;
  }
  try {
    // Carnet attend un nombre de km pour « distance » (plusieurs formats possibles ici) :
    // laissé vide pour que vous le précisiez une fois le format choisi ; le détail reste en note.
    await addRaceToCarnet({ name: r.name, sport: 'Ski de fond', date, location: r.location, notes: [`Distances : ${r.distance}`, r.notes, r.link].filter(Boolean).join(' — ') });
    added.add(id);
    saveAdded();
    card.querySelector('[data-race-check]').checked = false;
    card.querySelector('[data-race-check]').disabled = true;
    const btn = card.querySelector('[data-race-action="add"]');
    btn.disabled = true;
    btn.innerHTML = `${icon('check', 15)}<span>Ajoutée ✓</span>`;
    if (!silent) toast(`${r.name} ajoutée au planning de Carnet`);
    return true;
  } catch (error) {
    if (!silent) toastError(`Carnet injoignable : ${error.message}`);
    return false;
  }
}

export function initRaces() {
  $('#racesList').addEventListener('click', e => {
    const btn = e.target.closest('[data-race-action="add"]');
    if (btn) addOne(btn.closest('[data-race]'));
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
