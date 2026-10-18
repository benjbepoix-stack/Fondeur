/*
 * Onglet Courses : sélection de courses populaires de ski de fond (Jura,
 * Vosges, Alpes du Nord, Massif Central). Deux temps :
 * - « présélectionner » (étoile) : la course entre dans « Ma saison », sur
 *   l'appareil seulement, sans rien envoyer ;
 * - « valider » : la course part dans le planning de l'app Allure.
 * Chaque course propose deux éditions (en cours / suivante) via le sélecteur
 * d'année ; présélection et validation portent sur l'édition affichée.
 */
import { $, $$, esc } from '../core/utils.js';
import { readJSON, write } from '../services/storage.js';
import { addRacesToAllure, warmUp, onAllureUser, signInAllure, signOutAllure, describeAuthError } from '../services/allure-sync.js';
import { openSheet, closeSheet } from '../ui/dialog.js';
import { toast, toastError } from '../ui/toast.js';
import { haptic } from '../ui/haptics.js';
import { icon } from '../ui/icons.js';
import { RACES, RACE_GROUPS } from '../data/races.js';

/* Validées : envoyées à Allure (ou marquées comme déjà présentes). */
const ADDED_KEY = 'fondeur_races_added';
let added = new Set(readJSON(ADDED_KEY, []));
const saveAdded = () => write(ADDED_KEY, JSON.stringify([...added]));

/* Présélectionnées : { "course@année": "AAAA-MM-JJ" } (date retenue, modifiable). */
const PICKED_KEY = 'fondeur_races_picked';
const picked = (() => {
  const raw = readJSON(PICKED_KEY, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
})();
const savePicked = () => write(PICKED_KEY, JSON.stringify(picked));

const view = { group: 'all', yearIdx: 0 };
let pendingSend = null; // envoi à reprendre une fois connecté

function addedKey(raceId, year) {
  return `${raceId}@${year}`;
}

const editionOf = r => r.editions[view.yearIdx] || r.editions[0];
const keyOf = r => addedKey(r.id, editionOf(r).year);
const isMine = r => added.has(keyOf(r)) || keyOf(r) in picked;

const dayMonth = iso => {
  const d = new Date(`${iso}T12:00:00`);
  return [d.getDate(), d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')];
};

function raceCard(r) {
  const edition = editionOf(r);
  const key = keyOf(r);
  const isAdded = added.has(key);
  const isPicked = !isAdded && key in picked;
  const date = picked[key] || edition.date;
  const [day, month] = dayMonth(date);
  const state = isAdded ? 'validée' : isPicked ? 'présélectionnée' : '';
  const tags = [r.circuit, edition.confirmed ? 'date confirmée' : 'date à vérifier', state].filter(Boolean).join(' · ');
  const pickTitle = isAdded ? 'Validée, dans Allure' : isPicked ? 'Retirer de ma saison' : 'Présélectionner pour ma saison';
  return `<article class="race-card ${isAdded ? 'is-added' : ''} ${isPicked ? 'is-picked' : ''}" data-race="${esc(r.id)}">
    <header class="race-card__head">
      <span class="race-card__day" aria-hidden="true"><strong>${day}</strong><span>${esc(month)}</span></span>
      <div class="race-card__titles">
        <h3 class="race-card__name">${esc(r.name)}</h3>
        <p class="race-card__meta">${esc(r.location)}</p>
        <p class="race-card__tags ${r.circuit ? 'is-circuit' : ''}">${esc(tags)}</p>
      </div>
      <button type="button" class="race-card__pick ${isPicked ? 'is-on' : ''} ${isAdded ? 'is-done' : ''}" data-race-pick aria-pressed="${isPicked || isAdded}" ${isAdded ? 'disabled' : ''} title="${pickTitle}" aria-label="${esc(`${pickTitle} : ${r.name}`)}">${icon(isAdded ? 'check' : 'star', 18)}</button>
    </header>
    <p class="race-card__dist">${esc(r.distance)}</p>
    <p class="race-card__period">${esc(r.period)} · <a href="${esc(r.link)}" target="_blank" rel="noopener">Site officiel</a></p>
    ${r.notes ? `<p class="race-card__notes">${esc(r.notes)}</p>` : ''}
    <div class="race-card__actions">
      <input type="date" class="input race-card__date" data-race-date value="${esc(date)}" aria-label="Date de l'édition ${edition.year} pour ${esc(r.name)}">
      <button type="button" class="btn btn--soft btn--sm" data-race-action="add" ${isAdded ? 'disabled' : ''}>${icon(isAdded ? 'check' : 'plus', 15)}<span>${isAdded ? 'Validée ✓' : 'Valider'}</span></button>
      <button type="button" class="race-card__mark ${isAdded ? 'is-on' : ''}" data-race-mark aria-pressed="${isAdded}" title="${isAdded ? 'Dans Allure · toucher pour retirer la marque' : 'Marquer comme déjà dans Allure (sans l’envoyer)'}" aria-label="${isAdded ? 'Retirer la marque « validée »' : 'Marquer comme déjà dans Allure'}">${icon(isAdded ? 'check' : 'calendar', 15)}</button>
    </div>
  </article>`;
}

const raceOf = card => RACES.find(x => x.id === card.dataset.race);

/** Redessine une carte, ou toute la liste dans « Ma saison » (la carte peut en sortir). */
function refresh(card) {
  if (view.group === 'mine') renderRaces();
  else {
    card.outerHTML = raceCard(raceOf(card));
    updateBar();
    updateMineChip();
  }
}

/** Ajoute ou retire une course de la présélection (sans rien envoyer). */
function togglePick(card) {
  const r = raceOf(card);
  const key = keyOf(r);
  if (key in picked) delete picked[key];
  else picked[key] = card.querySelector('[data-race-date]').value || editionOf(r).date;
  savePicked();
  const now = key in picked;
  refresh(card);
  toast(now ? `${r.name} présélectionnée` : 'Retirée de ma saison', { type: 'info' });
}

/** Marque/démarque manuellement une course comme « déjà dans Allure », sans l'envoyer. */
function toggleMark(card) {
  const r = raceOf(card);
  const key = keyOf(r);
  const now = !added.has(key);
  if (now) {
    added.add(key);
    delete picked[key];
    savePicked();
  } else added.delete(key);
  saveAdded();
  refresh(card);
  toast(now ? 'Marquée comme déjà dans Allure' : 'Marque retirée', { type: 'info' });
}

function pendingPicks() {
  return RACES.filter(r => keyOf(r) in picked && !added.has(keyOf(r)));
}

function updateMineChip() {
  const btn = $('#racesGroups [data-race-group="mine"]');
  if (!btn) return;
  const n = RACES.filter(isMine).length;
  btn.textContent = `★ Ma saison${n ? ` (${n})` : ''}`;
}

function updateBar() {
  const n = pendingPicks().length;
  const bar = $('#racesBar');
  bar.hidden = n === 0;
  $('#racesBarCount').textContent = `${n} présélectionnée${n > 1 ? 's' : ''} à valider`;
  $('#racesBarAdd').textContent = view.group === 'mine' ? (n > 1 ? 'Tout valider' : 'Valider') : 'Voir ma saison';
}

export function renderRaces() {
  warmUp();
  const groupBtns = $$('#racesGroups [data-race-group]');
  if (groupBtns.length) groupBtns.forEach(b => b.setAttribute('aria-checked', String(b.dataset.raceGroup === view.group)));
  const yearBtns = $$('#racesYear [data-race-year]');
  if (yearBtns.length) yearBtns.forEach((b, i) => b.setAttribute('aria-checked', String(i === view.yearIdx)));
  const filtered =
    view.group === 'all' ? RACES
    : view.group === 'mine' ? RACES.filter(isMine)
    : view.group === 'circuit' ? RACES.filter(r => r.circuit)
    : RACES.filter(r => r.group === view.group);
  const editionDate = r => picked[keyOf(r)] || editionOf(r).date;
  const list = [...filtered].sort((a, b) => editionDate(a).localeCompare(editionDate(b)));
  const empty = view.group === 'mine'
    ? 'Aucune course pour cette saison. Touchez l’étoile d’une course pour la présélectionner.'
    : 'Aucune course dans cette catégorie.';
  $('#racesList').innerHTML = list.length ? list.map(raceCard).join('') : `<div class="empty">${empty}</div>`;
  updateBar();
  updateMineChip();
}

/**
 * Valide des courses : envoi groupé vers Allure, puis marque « validée ».
 * @param {{r:object, date:string}[]} items
 */
async function send(items) {
  const missing = items.find(it => !it.date);
  if (missing) {
    toastError(`Indiquez une date pour ${missing.r.name}.`);
    return;
  }
  try {
    const { added: n, already } = await addRacesToAllure(items.map(({ r, date }) => ({ name: r.name, sport: 'Ski de fond', date, location: r.location })));
    items.forEach(({ r }) => {
      added.add(keyOf(r));
      delete picked[keyOf(r)];
    });
    saveAdded();
    savePicked();
    renderRaces();
    if (items.length === 1) toast(n ? `${items[0].r.name} ajoutée au planning d’Allure` : `${items[0].r.name} était déjà dans Allure`);
    else toast(`${n} course${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''} au planning d’Allure${already ? ` · ${already} déjà présente${already > 1 ? 's' : ''}` : ''}`);
  } catch (error) {
    if (error.code === 'signed-out') {
      pendingSend = items;
      openAccount();
      return;
    }
    toastError(error.code ? error.message : `Allure injoignable : ${error.message}`);
  }
}

const itemOf = card => ({ r: raceOf(card), date: card.querySelector('[data-race-date]').value });

/* ---------- Compte (le même que dans Allure) ---------- */
function openAccount() {
  $('#allureAuthError').hidden = true;
  openSheet('allureAuthSheet', { focus: false, onClose: () => (pendingSend = null) });
}

function renderAccount(user) {
  const line = $('#racesAccount');
  if (!line) return;
  line.innerHTML = user
    ? `Allure : ${esc(user.email || 'connecté')} · <button type="button" class="link-btn" data-allure-signout>Se déconnecter</button>`
    : 'Allure : non connecté · <button type="button" class="link-btn" data-allure-signin>Se connecter</button>';
}

function initAccount() {
  onAllureUser(renderAccount);
  $('#racesAccount')?.addEventListener('click', async e => {
    if (e.target.closest('[data-allure-signin]')) openAccount();
    if (e.target.closest('[data-allure-signout]')) {
      await signOutAllure().catch(() => {});
      toast('Déconnecté d’Allure', { type: 'info' });
    }
  });
  $('#allureAuthForm').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget;
    const err = $('#allureAuthError');
    const submit = form.querySelector('[type=submit]');
    err.hidden = true;
    submit.disabled = true;
    try {
      await signInAllure(form.email.value.trim(), form.password.value);
      form.password.value = '';
      const items = pendingSend;
      pendingSend = null;
      closeSheet('allureAuthSheet');
      toast('Connecté à Allure');
      if (items) send(items);
    } catch (error) {
      err.textContent = describeAuthError(error);
      err.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

export function initRaces() {
  const groups = $('#racesGroups');
  if (groups) {
    groups.innerHTML = ['<button type="button" role="radio" data-race-group="all" aria-checked="true">Toutes</button>', '<button type="button" role="radio" data-race-group="mine" aria-checked="false">★ Ma saison</button>']
      .concat(RACE_GROUPS.map(g => `<button type="button" role="radio" data-race-group="${esc(g.id)}" aria-checked="false">${esc(g.label)}</button>`))
      .concat(['<button type="button" role="radio" data-race-group="circuit" aria-checked="false">Marathon Ski Tour</button>'])
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
    years.innerHTML = RACES[0].editions
      .map((ed, i) => `<button type="button" role="radio" data-race-year="${i}" aria-checked="${i === view.yearIdx}">${ed.year - 1}-${String(ed.year).slice(2)}</button>`)
      .join('');
    years.addEventListener('click', e => {
      const b = e.target.closest('[data-race-year]');
      if (!b) return;
      view.yearIdx = Number(b.dataset.raceYear);
      renderRaces();
    });
  }
  $('#racesList').addEventListener('click', e => {
    const addBtn = e.target.closest('[data-race-action="add"]');
    if (addBtn) return send([itemOf(addBtn.closest('[data-race]'))]);
    const pickBtn = e.target.closest('[data-race-pick]');
    if (pickBtn) {
      haptic();
      return togglePick(pickBtn.closest('[data-race]'));
    }
    const markBtn = e.target.closest('[data-race-mark]');
    if (markBtn) {
      haptic();
      toggleMark(markBtn.closest('[data-race]'));
    }
  });
  // Date modifiée sur une course présélectionnée : la nouvelle date est retenue.
  $('#racesList').addEventListener('change', e => {
    if (!e.target.matches('[data-race-date]') || !e.target.value) return;
    const card = e.target.closest('[data-race]');
    const key = keyOf(raceOf(card));
    if (!(key in picked)) return;
    picked[key] = e.target.value;
    savePicked();
  });
  $('#racesBarAdd').addEventListener('click', () => {
    if (view.group !== 'mine') {
      view.group = 'mine';
      renderRaces();
      return;
    }
    const items = pendingPicks().map(r => ({ r, date: picked[keyOf(r)] }));
    if (items.length) send(items);
  });
  initAccount();
}
