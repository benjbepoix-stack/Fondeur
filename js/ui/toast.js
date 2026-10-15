/* Notifications d'état (succès, erreur, info) empilables et accessibles. */
import { icon } from './icons.js';
import { esc } from '../core/utils.js';
import { spring, project, rubberband, tracker, reducedMotion } from './motion.js';

const ICONS = { success: 'check', error: 'alert', info: 'info', loading: null };
let host = null;

function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'toast-stack';
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  document.body.appendChild(host);
  return host;
}

/**
 * Affiche un toast.
 * @param {string} message
 * @param {{type?:'success'|'error'|'info'|'loading', duration?:number}} options
 * @returns {{close:Function, update:Function}}
 */
export function toast(message, { type = 'success', duration } = {}) {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const render = (msg, t) => {
    el.className = `toast toast--${t}`;
    el.innerHTML = `<span class="toast__icon">${ICONS[t] ? icon(ICONS[t], 18) : '<span class="spinner spinner--sm"></span>'}</span><span class="toast__text">${esc(msg)}</span>`;
  };
  render(message, type);
  ensureHost().appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));

  let timer = null;
  const close = () => {
    clearTimeout(timer);
    el.classList.remove('is-visible');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  const schedule = t => {
    clearTimeout(timer);
    const ms = duration ?? (t === 'error' ? 4500 : 2200);
    if (t !== 'loading') timer = setTimeout(close, ms);
  };
  schedule(type);
  el.addEventListener('click', () => {
    if (el.dataset.swiped) return; // clic émis à la fin d'un glissement
    close();
  });
  swipeToDismiss(el, close, () => clearTimeout(timer), () => schedule(type));
  return {
    close,
    update(msg, t = 'success') {
      render(msg, t);
      schedule(t);
    }
  };
}

export const toastError = message => toast(message, { type: 'error' });

/*
 * Glisser vers le haut pour chasser un toast (le chemin par lequel il est
 * arrivé). Vers le bas, il résiste puis revient à sa place.
 */
function swipeToDismiss(el, close, pause, resume) {
  el.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const startY = e.clientY;
    const track = tracker();
    let y = 0;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    pause();
    const set = v => {
      el.style.transition = 'none';
      el.style.transform = `translateY(${v}px)`;
      el.style.opacity = String(Math.max(0, 1 + Math.min(0, v) / 80));
    };
    const move = ev => {
      const d = ev.clientY - startY;
      if (!moved && Math.abs(d) < 6) return;
      moved = true;
      y = d > 0 ? rubberband(d, 120) : d;
      track.add(ev.clientY);
      set(y);
    };
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      if (!moved) return resume();
      // Le clic qui suit un glissement ne doit pas fermer une seconde fois.
      el.dataset.swiped = '1';
      setTimeout(() => delete el.dataset.swiped, 400);
      const velocity = track.velocity();
      const dismiss = y + project(velocity, 0.99) < -30;
      if (reducedMotion()) {
        el.style.transform = '';
        return dismiss ? close() : resume();
      }
      spring({
        from: y,
        to: dismiss ? -el.offsetHeight - 40 : 0,
        velocity,
        damping: dismiss ? 1 : 0.8,
        response: 0.3,
        onUpdate: set,
        onComplete: () => {
          if (dismiss) return el.remove();
          el.style.transition = '';
          el.style.transform = '';
          el.style.opacity = '';
          resume();
        }
      });
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });
}
