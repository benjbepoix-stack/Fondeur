/*
 * Stations favorites (enregistrées sur l'appareil).
 * « À niveau égal » : dans le classement, un favori passe devant une station
 * dont la note est au plus FAV_MARGIN points au-dessus. La note affichée
 * reste la note réelle.
 *
 * Stockage doublé (localStorage + IndexedDB) et stockage « persistant »
 * demandé au navigateur : iOS peut vider le localStorage d'une app web ;
 * la copie IndexedDB permet alors de retrouver les favoris.
 */
import { readJSON, write } from '../services/storage.js';

const KEY = 'fondeur_favorites';
const DB = 'fondeur';
const STORE = 'kv';
export const FAV_MARGIN = 3;

let favs = new Set(Array.isArray(readJSON(KEY, [])) ? readJSON(KEY, []) : []);

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

function save() {
  const list = [...favs];
  write(KEY, JSON.stringify(list));
  idb('readwrite', s => s.put(list, KEY)).catch(() => {});
}

/**
 * À appeler au démarrage : récupère la copie IndexedDB si le localStorage
 * a été vidé, et demande un stockage persistant. Retourne true si des
 * favoris ont été restaurés.
 */
export async function restoreFavorites() {
  navigator.storage?.persist?.().catch(() => {});
  try {
    const saved = await idb('readonly', s => s.get(KEY));
    if (Array.isArray(saved) && saved.length && !favs.size) {
      favs = new Set(saved);
      write(KEY, JSON.stringify(saved));
      return true;
    }
    if (favs.size && !(Array.isArray(saved) && saved.length)) save(); // première copie
  } catch {
    /* IndexedDB indisponible : localStorage seul */
  }
  return false;
}

export const isFavorite = id => favs.has(id);
export const favoriteCount = () => favs.size;

export function toggleFavorite(id) {
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  save();
  return favs.has(id);
}

/** Note utilisée pour le tri : +FAV_MARGIN pour les favoris. */
export const rankScore = (score, id) => (score === null || score === undefined ? -1 : score + (favs.has(id) ? FAV_MARGIN : 0));
