/* Fiche d'une station : note, conditions, bulletin officiel, commentaires des pisteurs, prévisions. */
import { $, esc } from '../core/utils.js';
import { openSheet } from '../ui/dialog.js';
import { fmtTemp } from '../core/score.js';
import { weatherLabel } from '../services/weather.js';
import { durationLabel } from '../services/routes.js';
import { directionsUrl, ring, shortDate, favButton } from './common.js';
import { rows, getState } from '../main.js';

const dayName = (iso, i) => (i === 0 ? 'Auj.' : new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''));
const tile = (label, value, note) => `<div class="tile"><span>${esc(label)}</span><strong>${esc(value)}</strong>${note ? `<small>${esc(note)}</small>` : ''}</div>`;

function bulletinBlock(r) {
  const b = r.bulletin;
  const s = r.station;
  if (!b) {
    return `<section class="section card bulletin"><h3 class="card__title">Bulletin officiel</h3>
      <p class="card__sub">${s.country === 'CH' ? 'Pas de bulletin automatique pour cette station.' : 'Bulletin indisponible pour le moment.'}</p>
      <a class="btn btn--soft btn--sm" href="${esc(s.bulletin)}" target="_blank" rel="noopener">Voir le bulletin en ligne</a></section>`;
  }
  if (b.source === 'ch') {
    return `<section class="section card bulletin"><header class="bulletin__head"><h3 class="card__title">Bulletin Suisse Tourisme</h3>${b.live ? '<span class="level is-good">En saison</span>' : '<span class="level is-none">Hors saison</span>'}</header>
      <p class="bulletin__summary">${esc(b.summary || '—')}</p>
      <a class="btn btn--soft btn--sm" href="${esc(b.url || s.bulletin)}" target="_blank" rel="noopener">Bulletin détaillé</a></section>`;
  }
  const facts = [
    ['Ouverture', b.open ? 'Ouvert' : 'Fermé'],
    ['Km ouverts', b.kmTotal ? `${Math.round(b.kmOpen || 0)} / ${Math.round(b.kmTotal)} km` : '—'],
    ['Pistes de fond', b.xcTotal ? `${b.xcOpen} / ${b.xcTotal}` : '—'],
    ['Hauteur de neige', b.snowMax !== null && b.snowMax !== undefined ? `${Math.round(b.snowMin || 0)} à ${Math.round(b.snowMax)} cm` : '—'],
    ['Qualité de neige', b.quality || 'Non renseignée'],
    ['Dernier damage', shortDate(b.lastGrooming)],
    ['Mise à jour', shortDate(b.updated)]
  ];
  const comments = (b.comments || []).map(
    c => `<li class="comment"><span class="comment__where">${esc(c.scope === 'secteur' ? `Secteur ${c.name}` : c.name)}${c.groomed ? ` · damé le ${shortDate(c.groomed)}` : ''}</span><p>${esc(c.text)}</p></li>`
  );
  return `<section class="section card bulletin">
    <header class="bulletin__head"><h3 class="card__title">Bulletin des pisteurs</h3>${b.live ? `<span class="level ${b.open ? 'is-good' : 'is-bad'}">${b.open ? 'Ouvert' : 'Fermé'}</span>` : `<span class="level is-none">Pas mis à jour depuis ${b.age ?? '?'} j</span>`}</header>
    <dl class="facts">${facts.map(([k, v]) => `<div class="fact"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${comments.length ? `<h4 class="bulletin__sub">Commentaires des pisteurs</h4><ul class="comments">${comments.join('')}</ul>` : '<p class="card__sub">Aucun commentaire des pisteurs.</p>'}
    <a class="btn btn--soft btn--sm" href="${esc(s.bulletin)}" target="_blank" rel="noopener">Bulletin officiel ENJ</a>
  </section>`;
}

export function openStation(id) {
  const r = rows().find(x => x.station.id === id) || null;
  const st = getState();
  const s = r?.station || st.stations.find(x => x.id === id);
  if (!s) return;
  $('#stationTitle').textContent = s.name;
  const wx = r?.wx;
  const route = st.routes[s.id];
  const head = `<section class="hero-card card">
    <div class="hero-card__top"><div class="hero-card__text"><p class="kicker">${esc(s.region)} · ${s.alt} m</p>
      <p class="hero-card__meta">${route ? `${durationLabel(route.minutes)} · ${route.km} km depuis ${esc(st.origin?.name || 'le départ')}${route.estimated ? ' (estimé)' : ''}` : ''}</p></div>
      <div class="hero-card__side">${ring(r?.score ?? null, 68)}${favButton(s.id, 'fav-btn--hero')}</div></div>
    ${r ? `<span class="verdict is-${r.level}">❄ ${esc(r.verdict)}</span>` : ''}
    <div class="hero-card__actions"><a class="btn btn--primary" href="${esc(directionsUrl(s, st.origin))}" target="_blank" rel="noopener">Itinéraire</a><a class="btn btn--soft" href="${esc(s.bulletin)}" target="_blank" rel="noopener">Bulletin</a></div>
  </section>`;
  if (!wx) {
    $('#stationContent').innerHTML = `${head}<p class="card__sub section">Météo en cours de chargement…</p>${bulletinBlock(r || { station: s, bulletin: null })}`;
    openSheet('stationSheet', { focus: false });
    return;
  }
  const tiles = [
    tile('Hauteur de neige', `${r.depth} cm`, r.measured ? 'mesurée par la station' : 'estimée (modèle météo)'),
    tile('Neige fraîche', `+${wx.fresh72} cm`, `sur 72 h · +${wx.fresh24} cm sur 24 h`),
    tile('Minimum cette nuit', fmtTemp(wx.tMinNight), wx.tMinNight <= -4 ? 'regel : neige dure le matin' : wx.tMinNight > 0 ? 'pas de regel' : 'léger regel'),
    tile('Maximum du jour', fmtTemp(wx.tMaxToday), wx.tMaxToday > 4 ? 'neige qui ramollit' : 'neige qui tient'),
    tile('Pluie sur 48 h', `${String(wx.rain48).replace('.', ',')} mm`, wx.rain48 > 0.4 ? 'neige mouillée' : 'aucune pluie'),
    tile('Vent max', `${Math.round(wx.windMax)} km/h`, weatherLabel(wx.code)[1])
  ];
  const days = wx.days
    .map((d, i) => {
      const [ico] = weatherLabel(d.code);
      const note = d.snow >= 1 ? `+${Math.round(d.snow)} cm` : d.rain >= 1 ? 'pluie' : '';
      return `<div class="day"><b>${esc(dayName(d.date, i))}</b><span class="day__ico">${ico}</span><span class="day__t">${Math.round(d.tmin)}/${Math.round(d.tmax)}°</span><span class="day__s ${d.rain >= 1 && !(d.snow >= 1) ? 'is-rain' : ''}">${note || '&nbsp;'}</span></div>`;
    })
    .join('');
  const why = r.factors
    .map(f => `<div class="why__row"><span><strong>${esc(f.label)}</strong><small>${esc(f.note)}</small></span><em class="${f.pts < 0 ? 'is-minus' : ''}">${f.pts > 0 ? '+' : ''}${f.pts}${f.max ? `<small>/${f.max}</small>` : ''}</em></div>`)
    .join('');
  $('#stationContent').innerHTML = `${head}
    <div class="tiles section">${tiles.join('')}</div>
    ${bulletinBlock(r)}
    <section class="section"><header class="section__head"><h3 class="section__title">5 prochains jours</h3><span class="card__sub">à ${s.alt} m</span></header><div class="days">${days}</div></section>
    <section class="section"><header class="section__head"><h3 class="section__title">Pourquoi cette note</h3><span class="card__sub">skating</span></header><div class="card why">${why}</div></section>`;
  openSheet('stationSheet', { focus: false });
}

export function initStation() {}
