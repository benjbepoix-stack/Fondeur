/*
 * Stations favorites (enregistrées sur l'appareil).
 * « À niveau égal » : dans le classement, un favori passe devant une station
 * dont la note est au plus FAV_MARGIN points au-dessus. La note affichée
 * reste la note réelle.
 */
import { readJSON, write } from '../services/storage.js';

const KEY = 'fondeur_favorites';
export const FAV_MARGIN = 3;

let favs = new Set(readJSON(KEY, []));

export const isFavorite = id => favs.has(id);
export const favoriteCount = () => favs.size;

export function toggleFavorite(id) {
  if (favs.has(id)) favs.delete(id);
  else favs.add(id);
  write(KEY, JSON.stringify([...favs]));
  return favs.has(id);
}

/** Note utilisée pour le tri : +FAV_MARGIN pour les favoris. */
export const rankScore = (score, id) => (score === null || score === undefined ? -1 : score + (favs.has(id) ? FAV_MARGIN : 0));
