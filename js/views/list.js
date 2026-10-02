/* Classement : meilleur choix mis en avant puis toutes les stations. */
import { $, esc } from '../core/utils.js';
import { fmtTemp, levelOf } from '../core/score.js';
import { durationLabel } from '../services/routes.js';
import { directionsUrl, ring, flag, favButton } from './common.js';

const km = r => (r.route ? `${durationLabel(r.route.minutes)}${r.route.estimated ? ' (estimé)' : ''}` : '…');

function bestCard(r, origin) {
  const b = r.bulletin;
  const open = b?.live && b.kmTotal ? `${Math.round(b.kmOpen || 0)} / ${Math.round(b.kmTotal)} km ouverts` : `${r.station.alt} m`;
  const chips = [
    [`${r.depth} cm`, r.measured ? 'neige (station)' : 'neige (estim.)'],
    [r.wx.fresh72 ? `+${r.wx.fresh72}` : '0', 'cm / 72 h'],
    [fmtTemp(r.wx.tMinNight).replace(' °C', '°'), 'cette nuit'],
    [fmtTemp(r.wx.tMaxToday).replace(' °C', '°'), 'max jour']
  ];
  return `<section class="hero-card card" data-station="${esc(r.station.id)}">
    <div class="hero-card__top">
      <div class="hero-card__text">
        <p class="kicker">Meilleur choix${r.station.country === 'CH' ? ' · Suisse' : ''}${r.fav ? ' · ★ favori' : ''}</p>
        <h2 class="hero-card__name">${esc(r.station.name)}</h2>
        <p class="hero-card__meta">${esc(km(r))} · ${esc(open)}</p>
      </div>
      <div class="hero-card__side">${ring(r.score, 68)}${favButton(r.station.id, 'fav-btn--hero')}</div>
    </div>
    <span class="verdict is-${r.level}">❄ ${esc(r.verdict)}</span>
    <div class="chips">${chips.map(([v, l]) => `<div class="chip"><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join('')}</div>
    <div class="hero-card__actions">
      <a class="btn btn--primary" href="${esc(directionsUrl(r.station, origin))}" target="_blank" rel="noopener">Itinéraire</a>
      <button type="button" class="btn btn--soft" data-station="${esc(r.station.id)}">Détails</button>
    </div>
  </section>`;
}

function row(r, i) {
  const lvl = levelOf(r.score);
  const meta = [
    r.station.country === 'CH' ? `${flag('CH')} ${r.station.region}` : r.station.region,
    `${r.station.alt} m`,
    km(r),
    r.wx ? `${fmtTemp(r.wx.tMinNight)} cette nuit` : null
  ]
    .filter(Boolean)
    .join(' · ');
  const b = r.bulletin;
  const status = r.closed ? 'Fermé' : b?.live && b.kmTotal ? `${Math.round(b.kmOpen || 0)} km` : `${r.depth} cm`;
  return `<div class="rank-row ${r.fav ? 'is-fav' : ''}" data-station="${esc(r.station.id)}" role="button" tabindex="0" aria-label="${esc(r.station.name)}, note ${r.score ?? 'inconnue'}">
    <span class="rank-row__pos">${i + 1}</span>
    <span class="rank-row__body">
      <span class="rank-row__name">${esc(r.station.name)}</span>
      <span class="rank-row__meta">${meta}</span>
      <span class="bar"><i class="is-${lvl}" style="width:${r.score ?? 0}%"></i></span>
    </span>
    <span class="rank-row__score is-${lvl}">${r.score ?? '—'}<small>${esc(status)}</small></span>
    ${favButton(r.station.id)}
  </div>`;
}

export function renderList(list, state) {
  const ready = list.filter(r => r.score !== null);
  $('#rankCount').textContent = list.length ? `${list.length} station${list.length > 1 ? 's' : ''}` : '';
  if (!ready.length) {
    $('#best').innerHTML = `<section class="hero-card card hero-card--loading"><div class="spinner"></div><p>Chargement de la météo des stations…</p></section>`;
    $('#ranking').innerHTML = list.length ? '' : '<div class="empty-state"><p>Aucune station ne correspond aux filtres.</p></div>';
    if (!list.length) $('#best').innerHTML = '';
    return;
  }
  $('#best').innerHTML = bestCard(ready[0], state.origin);
  $('#ranking').innerHTML = list.slice(1).map((r, i) => row(r, i + 1)).join('') || '<div class="empty-state"><p>Aucune autre station avec ces filtres.</p></div>';
}
