/* « Aujourd'hui » : une seule réponse en grand, puis les stations suivantes en cartes. */
import { $, esc } from '../core/utils.js';
import { fmtTemp, levelOf } from '../core/score.js';
import { durationLabel } from '../services/routes.js';
import { directionsUrl, favButton } from './common.js';

const deg = t => fmtTemp(t).replace(' °C', '°');
const travel = r => (r.route ? `${durationLabel(r.route.minutes)}${r.route.estimated ? ' (estimé)' : ''}` : null);

const LEADS = { score: 'Meilleur choix', distance: 'Le plus proche', night: 'Nuit la plus froide' };

function answer(r, state) {
  const b = r.bulletin;
  const when = new Date().getHours() < 11 ? ' ce matin' : '';
  const lead = `${LEADS[state.prefs.sort] || LEADS.score}${state.prefs.sort === 'score' ? when : ''}${r.station.country === 'CH' ? ' · Suisse' : ''}`;
  const facts = [
    `${r.depth} cm${r.measured ? '' : ' (estim.)'}`,
    `${deg(r.wx.tMinNight)} cette nuit`,
    b?.live && b.kmTotal ? `${Math.round(b.kmOpen || 0)}/${Math.round(b.kmTotal)} km ouverts` : `${r.station.alt} m`
  ];
  const go = travel(r);
  return `<section class="answer" aria-labelledby="answerName" style="view-transition-name: answer">
    <p class="lab">${esc(lead)}</p>
    <div class="answer__title">
      <h2 class="answer__name" id="answerName">${esc(r.station.name)}</h2>
      ${favButton(r.station.id, 'fav-btn--hero')}
    </div>
    <p class="answer__score" aria-label="Note ${r.score} sur 100"><span class="answer__num">${r.score}</span><span class="answer__of">/100</span></p>
    <p class="answer__verdict is-${r.level}">${esc(r.verdict)}</p>
    <p class="answer__facts">${facts.map(esc).join(' · ')}</p>
    <div class="answer__actions">
      <a class="btn btn--primary btn--lg" href="${esc(directionsUrl(r.station, state.origin))}" target="_blank" rel="noopener">Y aller${go ? ` · ${esc(go)}` : ''}</a>
      <button type="button" class="btn btn--soft btn--lg" data-station="${esc(r.station.id)}">Fiche</button>
    </div>
  </section>`;
}

function card(r, pos) {
  const lvl = levelOf(r.score);
  const top = [pos, r.route ? durationLabel(r.route.minutes) : null, r.station.country === 'CH' ? 'CH' : null].filter(Boolean).join(' · ');
  const foot = r.closed ? 'Fermé' : r.wx ? `${deg(r.wx.tMinNight)} la nuit` : '';
  // Nom de transition propre à la station : la carte glisse vers sa nouvelle place quand le classement change.
  return `<div class="nx ${r.fav ? 'is-fav' : ''}" style="view-transition-name: nx-${esc(r.station.id)}" data-station="${esc(r.station.id)}" role="button" tabindex="0" aria-label="${esc(r.station.name)}, note ${r.score ?? 'inconnue'}">
    <span class="nx__top"><span>${esc(top)}</span>${favButton(r.station.id, 'fav-btn--sm')}</span>
    <strong class="nx__name">${esc(r.station.name)}</strong>
    <span class="nx__score is-${lvl}">${r.score ?? '—'}</span>
    <span class="nx__foot">${esc(foot)}</span>
  </div>`;
}

export function renderList(list, state) {
  const ready = list.filter(r => r.score !== null);
  $('#rankCount').textContent = list.length > 1 ? `${list.length - 1} station${list.length > 2 ? 's' : ''}` : '';
  $('#nextSection').hidden = list.length < 2 || !ready.length;
  if (!ready.length) {
    $('#best').innerHTML = list.length
      ? `<section class="answer answer--skeleton" role="status" aria-busy="true">
          <span class="visually-hidden">Chargement de la météo des stations…</span>
          <span class="skeleton sk-lab"></span><span class="skeleton sk-name"></span><span class="skeleton sk-num"></span>
          <span class="skeleton sk-line"></span><span class="skeleton sk-facts"></span>
          <span class="sk-actions"><span class="skeleton"></span><span class="skeleton"></span></span>
        </section>`
      : '<div class="empty-state"><p>Aucune station ne correspond aux réglages.</p></div>';
    $('#ranking').innerHTML = '';
    return;
  }
  $('#best').innerHTML = answer(ready[0], state);
  $('#ranking').innerHTML = list
    .filter(r => r !== ready[0])
    .map((r, i) => card(r, i + 2))
    .join('');
}
