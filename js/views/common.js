/* Éléments d'affichage partagés. */
import { levelOf } from '../core/score.js';

const isApple = () => /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

/** Lien d'itinéraire : Plans sur iPhone / Mac, Google Maps ailleurs. */
export function directionsUrl(s, origin) {
  if (isApple()) return `https://maps.apple.com/?daddr=${s.lat},${s.lon}${origin ? `&saddr=${origin.lat},${origin.lon}` : ''}&dirflg=d`;
  return `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin.lat},${origin.lon}` : ''}&destination=${s.lat},${s.lon}&travelmode=driving`;
}

/** Anneau de note (0-100). */
export function ring(score, size = 64) {
  const lvl = levelOf(score);
  return `<span class="ring is-${lvl}" style="--p:${score ?? 0};--s:${size}px" role="img" aria-label="Note ${score ?? 'inconnue'} sur 100"><b>${score ?? '—'}</b></span>`;
}

export const flag = c => (c === 'CH' ? '🇨🇭' : '🇫🇷');

export const shortDate = iso => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '') : '—');
