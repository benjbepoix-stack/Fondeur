/* « Aujourd'hui » : une seule réponse en grand, puis les stations suivantes en cartes. */
import { $, esc } from '../core/utils.js';
import { fmtTemp, levelOf } from '../core/score.js';
import { durationLabel } from '../services/routes.js';
import { directionsUrl, favButton } from './common.js';
import { reducedMotion } from '../ui/motion.js';

const deg = t => fmtTemp(t).replace(' °C', '°');
const travel = r => (r.route ? `${durationLabel(r.route.minutes)}${r.route.estimated ? ' (estimé)' : ''}` : null);

const LEADS = { score: 'Meilleur choix', distance: 'Le plus proche', night: 'Nuit la plus froide' };

/*
 * Neige qui tombe derrière la réponse quand il a neigé ces trois derniers jours :
 * plus il en est tombé, plus il y a de flocons ; le vent les fait dériver.
 * Positions tirées d'une suite fixe et phase calée sur l'horloge : un nouveau
 * rendu retrouve chaque flocon là où il était.
 */
function snowfall(wx) {
  if (!wx || !(wx.fresh72 >= 1)) return '';
  const count = Math.min(10 + Math.round(wx.fresh72) * 2, 36);
  const drift = Math.min(Math.round(wx.windMax || 0), 40) * 1.5;
  const now = performance.now() / 1000;
  const rand = i => ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const flakes = Array.from({ length: count }, (_, i) => {
    const dur = 6 + rand(i + 1) * 6;
    const phase = (now + rand(i + 2) * dur) % dur;
    return `<i style="--x:${(rand(i + 3) * 100).toFixed(1)}%;--s:${(2 + rand(i + 4) * 4).toFixed(1)}px;--o:${(0.35 + rand(i + 5) * 0.5).toFixed(2)};--dur:${dur.toFixed(2)}s;--delay:${(-phase).toFixed(2)}s;--drift:${Math.round(drift * (0.5 + rand(i + 6)))}px"></i>`;
  });
  return `<div class="snowfall" aria-hidden="true">${flakes.join('')}</div>`;
}

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
    ${snowfall(r.wx)}
    <p class="lab">${esc(lead)}</p>
    <div class="answer__title" style="--d:1">
      <h2 class="answer__name" id="answerName">${esc(r.station.name)}</h2>
      ${favButton(r.station.id, 'fav-btn--hero')}
    </div>
    <svg class="trace" style="--d:2" viewBox="0 0 160 16" aria-hidden="true"><path pathLength="1" d="M2 8 C 16 1, 26 1, 40 8 S 66 15, 80 8 S 106 1, 120 8 S 146 15, 158 8"/></svg>
    <p class="answer__score" style="--d:2" aria-label="Note ${r.score} sur 100"><span class="answer__num" data-score="${r.score}">${r.score}</span><span class="answer__of">/100</span></p>
    <p class="answer__verdict is-${r.level}" style="--d:3">${esc(r.verdict)}</p>
    <p class="answer__facts" style="--d:4">${facts.map(esc).join(' · ')}</p>
    <div class="answer__actions" style="--d:5">
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
  return `<div class="nx ${r.fav ? 'is-fav' : ''}" style="view-transition-name: nx-${esc(r.station.id)}; --d: ${Math.min(pos + 4, 12)}" data-station="${esc(r.station.id)}" role="button" tabindex="0" aria-label="${esc(r.station.name)}, note ${r.score ?? 'inconnue'}">
    <span class="nx__top"><span>${esc(top)}</span>${favButton(r.station.id, 'fav-btn--sm')}</span>
    <strong class="nx__name">${esc(r.station.name)}</strong>
    <span class="nx__score is-${lvl}">${r.score ?? '—'}</span>
    <span class="nx__foot">${esc(foot)}</span>
  </div>`;
}

/*
 * Première apparition de la réponse : les éléments montent l'un après l'autre
 * et la note compte jusqu'à sa valeur. L'écran est reconstruit plusieurs fois
 * au démarrage (météo, bulletins, trajets) : --t décale les animations du temps
 * déjà écoulé, pour qu'un nouveau rendu reprenne là où en était le précédent.
 */
const REVEAL_MS = 1100;
const COUNT_MS = 700;
let revealAt = 0;

function syncReveal() {
  const view = $('#listView');
  // Écran pas encore visible (onglet en arrière-plan) : l'apparition attend qu'on le regarde.
  if (!revealAt && document.hidden) return;
  if (!revealAt) revealAt = reducedMotion() ? -Infinity : performance.now();
  const t = performance.now() - revealAt;
  view.classList.toggle('is-revealing', t < REVEAL_MS);
  if (t < REVEAL_MS) view.style.setProperty('--t', `${Math.round(t)}ms`);
  if (t < COUNT_MS) countUp();
}

let counting = 0;
function countUp() {
  if (counting) return;
  const step = () => {
    const num = $('#best .answer__num');
    const p = Math.min((performance.now() - revealAt) / COUNT_MS, 1);
    if (num) num.textContent = Math.round(Number(num.dataset.score) * (1 - (1 - p) ** 3));
    counting = p < 1 ? requestAnimationFrame(step) : 0;
  };
  step();
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
    $('#listView').classList.remove('is-revealing');
    return;
  }
  $('#best').innerHTML = answer(ready[0], state);
  $('#ranking').innerHTML = list
    .filter(r => r !== ready[0])
    .map((r, i) => card(r, i + 2))
    .join('');
  syncReveal();
}
