/* Fiche d'une station : note, conditions, bulletin officiel, commentaires des pisteurs, prévisions. */
import { $, $$, esc } from '../core/utils.js';
import { openSheet } from '../ui/dialog.js';
import { fmtTemp } from '../core/score.js';
import { waxFor } from '../core/wax.js';
import { weatherLabel } from '../services/weather.js';
import { durationLabel } from '../services/routes.js';
import { directionsUrl, shortDate, favButton } from './common.js';
import { rows, getState } from '../main.js';

const dayName = (iso, i) => (i === 0 ? 'Auj.' : new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''));
/** Webcams : images en direct quand la source en fournit une, sinon liens. */
function webcamBlock(s, page) {
  const cams = s.webcams || [];
  const stamp = Math.floor(Date.now() / 600000); // rafraîchie toutes les 10 min
  const imgs = cams.filter(c => c.image);
  const links = cams.filter(c => !c.image);
  const more = s.country === 'FR' && page ? page : s.country === 'CH' ? 'https://snow.myswitzerland.com/webcams/' : null;
  if (!cams.length && !more) return '';
  return `<section class="section"><header class="section__head"><h3 class="section__title">Webcams</h3><span class="card__sub">${cams.length ? `${cams.length} caméra${cams.length > 1 ? 's' : ''}` : ''}</span></header>
    ${imgs.map(c => `<a class="cam-img card" href="${esc(c.url)}" target="_blank" rel="noopener"><img src="${esc(c.url)}?t=${stamp}" alt="Webcam ${esc(c.name)}" loading="lazy" onerror="this.closest('a').hidden=true"><span>${esc(c.name)} · en direct</span></a>`).join('')}
    ${links.length ? `<div class="card card--list">${links.map(c => `<a class="cam-link" href="${esc(c.url)}" target="_blank" rel="noopener"><span class="cam-link__ico">📷</span><span class="cam-link__name">${esc(c.name)}</span><span class="cam-link__go">Voir ›</span></a>`).join('')}</div>` : ''}
    ${!cams.length ? `<a class="btn btn--soft btn--sm" href="${esc(more)}" target="_blank" rel="noopener">${s.country === 'CH' ? 'Webcams de Suisse (Suisse Tourisme)' : 'Toutes les webcams ENJ'}</a>` : ''}
  </section>`;
}

const kpi = (value, label) => `<div class="kpi"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;

function waxCard(label, tempC) {
  const w = waxFor(tempC);
  if (!w) return `<div class="wax-card wax-card--empty"><span>${esc(label)}</span><strong>—</strong></div>`;
  return `<div class="wax-card" style="--c:${w.color}"><span class="wax-card__swatch" aria-hidden="true"></span><div class="wax-card__text"><span>${esc(label)} · ${esc(fmtTemp(w.temp).replace(' °C', '°'))}</span><strong>${esc(w.name)}</strong><small>${esc(w.note)}</small></div></div>`;
}

function waxBlock(wx) {
  return `<section class="section"><header class="section__head"><h3 class="lab">Fart · repère température</h3></header>
    <div class="wax-cards">${waxCard('Matin', wx.tMinNight)}${waxCard('Après-midi', wx.tMaxToday)}</div>
  </section>`;
}

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

/** Barre empilée « Pourquoi cette note », détail dépliable. */
function whyBlock(r) {
  const parts = r.factors.filter(f => f.pts > 0);
  const rest = Math.max(0, 100 - parts.reduce((t, f) => t + f.pts, 0));
  const short = { snow: 'Neige', open: 'Pistes', night: 'Regel', day: 'Température', groom: 'Damage', weather: 'Pluie, vent', fresh: 'Neige fraîche' };
  const legend = r.factors.map(f => `${short[f.key] || f.label} ${f.pts}${f.max ? `/${f.max}` : ''}`).join(' · ');
  const rows = r.factors
    .map(f => `<div class="why__row"><span><strong>${esc(f.label)}</strong><small>${esc(f.note)}</small></span><em class="${f.pts < 0 ? 'is-minus' : ''}">${f.pts > 0 ? '+' : ''}${f.pts}${f.max ? `<small>/${f.max}</small>` : ''}</em></div>`)
    .join('');
  return `<section class="section"><header class="section__head"><h3 class="lab">Pourquoi ${r.score}</h3><span class="lab">skating</span></header>
    <div class="why-bar" role="img" aria-label="${esc(legend)}">${parts.map((f, i) => `<span style="flex:${f.pts};--k:${i}"></span>`).join('')}<span class="why-bar__rest" style="flex:${rest}"></span></div>
    <p class="why-legend">${esc(legend)}</p>
    <details class="why-more"><summary>Détailler</summary><div class="card why">${rows}</div></details>
  </section>`;
}

function forecastBlock(s, wx) {
  const days = wx.days
    .map((d, i) => {
      const [ico] = weatherLabel(d.code);
      const note = d.snow >= 1 ? `+${Math.round(d.snow)} cm` : d.rain >= 1 ? 'pluie' : '';
      return `<div class="day"><b>${esc(dayName(d.date, i))}</b><span class="day__ico">${ico}</span><span class="day__t">${Math.round(d.tmin)}/${Math.round(d.tmax)}°</span><span class="day__s ${d.rain >= 1 && !(d.snow >= 1) ? 'is-rain' : ''}">${note || '&nbsp;'}</span></div>`;
    })
    .join('');
  return `<section class="section"><header class="section__head"><h3 class="lab">5 prochains jours</h3><span class="lab">à ${s.alt} m</span></header><div class="days">${days}</div>
    <p class="card__sub forecast-crosscheck">À recouper : <a href="https://www.meteofranccomtoise.fr/" target="_blank" rel="noopener">Météo Franc-Comtoise</a></p>
  </section>`;
}

const PANELS = [
  ['conditions', 'Conditions'],
  ['bulletin', 'Bulletin'],
  ['forecast', '5 jours']
];

export function openStation(id) {
  const r = rows().find(x => x.station.id === id) || null;
  const st = getState();
  const s = r?.station || st.stations.find(x => x.id === id);
  if (!s) return;
  $('#stationTitle').textContent = s.name;
  const wx = r?.wx;
  const route = st.routes[s.id];
  const meta = [s.region, `${s.alt} m`, route ? durationLabel(route.minutes) : null, route ? `${route.km} km` : null].filter(Boolean).join(' · ');
  const head = `<section class="fiche-head">
    <div class="fiche-head__text">
      <p class="lab">${esc(meta)}${route?.estimated ? ' (estimé)' : ''}</p>
      ${r ? `<p class="answer__verdict is-${r.level}">${esc(r.verdict)}</p>` : ''}
    </div>
    <div class="fiche-head__side"><span class="fiche-head__score">${r?.score ?? '—'}</span>${favButton(s.id, 'fav-btn--hero')}</div>
  </section>`;
  const tabs = `<div class="segmented fiche-tabs" role="tablist" aria-label="Volets de la fiche">${PANELS.map(
    ([key, label], i) => `<button type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${i === 0}" data-panel-tab="${key}">${label}</button>`
  ).join('')}<span class="fiche-tabs__thumb" aria-hidden="true"></span></div>`;
  const panel = (key, html, open = false) => `<div class="fiche-panel" role="tabpanel" id="panel-${key}" aria-labelledby="tab-${key}" ${open ? '' : 'hidden'}>${html}</div>`;
  const cta = `<div class="fiche-cta"><a class="btn btn--primary btn--lg btn--block" href="${esc(directionsUrl(s, st.origin))}" target="_blank" rel="noopener">Itinéraire${route ? ` · ${esc(durationLabel(route.minutes))}` : ''}</a></div>`;

  let conditions;
  if (!wx) {
    conditions = `<p class="card__sub section">Météo en cours de chargement…</p>${webcamBlock(s, st.webcamsPage)}`;
  } else {
    const kpis = [
      kpi(`${r.depth} cm`, r.measured ? 'neige mesurée' : 'neige estimée'),
      kpi(`+${wx.fresh72} cm`, `frais sur 72 h`),
      kpi(fmtTemp(wx.tMinNight).replace(' °C', '°'), wx.tMinNight <= -1 ? 'regel cette nuit' : 'pas de regel'),
      kpi(fmtTemp(wx.tMaxToday).replace(' °C', '°'), wx.tMaxToday > 4 ? 'max · neige molle' : 'max du jour'),
      kpi(`${String(wx.rain48).replace('.', ',')} mm`, 'pluie 48 h'),
      kpi(`${Math.round(wx.windMax)}`, 'km/h de vent')
    ];
    conditions = `<div class="kpis">${kpis.join('')}</div>${waxBlock(wx)}${whyBlock(r)}${webcamBlock(s, st.webcamsPage)}`;
  }
  const bulletin = bulletinBlock(r || { station: s, bulletin: null });
  const forecast = wx ? forecastBlock(s, wx) : '<p class="card__sub section">Prévisions en cours de chargement…</p>';
  $('#stationContent').innerHTML = `${head}${tabs}${panel('conditions', conditions, true)}${panel('bulletin', bulletin)}${panel('forecast', forecast)}${cta}`;
  $('#stationContent').scrollTop = 0;
  openSheet('stationSheet', { focus: false });
}

export function initStation() {
  $('#stationContent').addEventListener('click', e => {
    const tab = e.target.closest('[data-panel-tab]');
    if (!tab) return;
    const tabs = $$('#stationContent [data-panel-tab]');
    tabs.forEach(b => b.setAttribute('aria-selected', String(b === tab)));
    tab.parentElement.style.setProperty('--i', tabs.indexOf(tab));
    $$('#stationContent .fiche-panel').forEach(p => (p.hidden = p.id !== `panel-${tab.dataset.panelTab}`));
  });
}
