/*
 * Système de modales unifié :
 * - feuille glissante (bottom sheet) sur mobile, boîte centrée sur ordinateur ;
 * - pile de modales (une confirmation peut s'ouvrir au-dessus d'une autre) ;
 * - fermeture par Échap, clic sur le fond ou bouton [data-close] ;
 * - blocage du défilement et restitution du focus.
 * Remplace aussi confirm()/prompt() natifs par des dialogues élégants.
 */
import { esc } from '../core/utils.js';
import { icon } from './icons.js';
import { spring, project, rubberband, tracker, reducedMotion } from './motion.js';

const stack = [];
const ANIMATION_MS = 320;
const hideTimers = new WeakMap();
const isSheetLayout = () => window.matchMedia('(max-width: 719px)').matches;

function syncLock() {
  document.documentElement.classList.toggle('is-locked', stack.length > 0);
}

/* Sur ordinateur, la boîte grandit depuis le bouton qui l'a ouverte. */
function anchorTo(el, trigger) {
  const sheet = el.querySelector('.sheet');
  if (!sheet) return;
  sheet.style.transformOrigin = '';
  if (isSheetLayout() || !trigger?.getBoundingClientRect || trigger === document.body) return;
  const t = trigger.getBoundingClientRect();
  const r = sheet.getBoundingClientRect();
  if (!t.width) return;
  sheet.style.transformOrigin = `${t.left + t.width / 2 - r.left}px ${t.top + t.height / 2 - r.top}px`;
}

export function openSheet(target, { onClose, focus = true } = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if (!el) return;
  if (stack.some(s => s.el === el)) return;
  clearTimeout(hideTimers.get(el));
  const returnFocus = document.activeElement;
  stack.push({ el, onClose, returnFocus });
  const wasHidden = el.hidden;
  el.hidden = false;
  if (wasHidden) anchorTo(el, returnFocus);
  void el.offsetWidth; // force le reflow pour déclencher la transition
  el.classList.add('is-open');
  syncLock();
  if (focus) {
    const first = el.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea, button:not([data-close])');
    // Pas d'autofocus sur mobile tactile : le clavier iOS masquerait la feuille.
    const touch = window.matchMedia('(pointer: coarse)').matches;
    setTimeout(() => (touch ? el.querySelector('.sheet')?.focus({ preventScroll: true }) : first?.focus({ preventScroll: true })), 60);
  }
}

export function closeSheet(target, { immediate = false } = {}) {
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  const index = stack.findIndex(s => s.el === el);
  if (index === -1) return;
  const [entry] = stack.splice(index, 1);
  if (immediate) {
    // Feuille déjà sortie de l'écran par le geste : on la masque sans rejouer la transition.
    el.hidden = true;
    el.classList.remove('is-open');
    resetDrag(el);
  } else {
    resetDrag(el);
    el.classList.remove('is-open');
    hideTimers.set(el, setTimeout(() => {
      if (!el.classList.contains('is-open')) el.hidden = true;
    }, ANIMATION_MS));
  }
  syncLock();
  entry.returnFocus?.focus?.({ preventScroll: true });
  entry.onClose?.();
}

export const isOpen = id => stack.some(s => s.el.id === id);
export const closeTop = () => stack.length && closeSheet(stack[stack.length - 1].el);

/* ---------- Glisser pour fermer (feuilles sur mobile) ---------- */
const drags = new WeakMap();

function setDrag(el, y) {
  const sheet = el.querySelector('.sheet');
  const h = sheet.offsetHeight || 1;
  sheet.style.transition = 'none';
  sheet.style.transform = `translateY(${y}px)`;
  el.style.setProperty('--scrim', String(Math.max(0, 1 - Math.max(0, y) / h)));
}

function resetDrag(el) {
  const sheet = el.querySelector('.sheet');
  drags.get(el)?.stop?.();
  drags.delete(el);
  if (sheet) {
    sheet.style.transition = '';
    sheet.style.transform = '';
  }
  el.style.removeProperty('--scrim');
}

function initSheetDrag() {
  document.addEventListener('pointerdown', e => {
    if (!isSheetLayout() || e.button > 0) return;
    const handle = e.target.closest('.sheet__grabber, .sheet__head');
    if (!handle || e.target.closest('button, a, input, select, textarea')) return;
    const el = handle.closest('.sheet-backdrop');
    const sheet = el?.querySelector('.sheet');
    if (!sheet || !el.classList.contains('is-open')) return;

    // Interruption : on repart de la position affichée, pas de la cible.
    const current = drags.get(el);
    current?.stop?.();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(sheet).transform);
    const startOffset = matrix.m42 || 0;
    const startY = e.clientY;
    const track = tracker();
    let offset = startOffset;
    let moved = false;
    handle.setPointerCapture(e.pointerId);
    drags.set(el, { stop: null });

    const move = ev => {
      const raw = startOffset + ev.clientY - startY;
      if (!moved && Math.abs(ev.clientY - startY) < 6 && !current) return;
      moved = true;
      offset = raw < 0 ? rubberband(raw, sheet.offsetHeight) : raw;
      track.add(ev.clientY);
      setDrag(el, offset);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (!moved && !current) return resetDrag(el);
      const h = sheet.offsetHeight;
      const velocity = track.velocity();
      const close = offset + project(velocity) > h * 0.5 && velocity > -50;
      if (reducedMotion()) return close ? closeSheet(el, { immediate: true }) : resetDrag(el);
      const stop = spring({
        from: offset,
        to: close ? h : 0,
        velocity,
        damping: close ? 1 : 0.8,
        response: 0.3,
        onUpdate: y => setDrag(el, y),
        onComplete: () => (close ? closeSheet(el, { immediate: true }) : resetDrag(el))
      });
      drags.set(el, { stop });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  });
}

export function initDialogs() {
  initSheetDrag();
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && stack.length) {
      e.preventDefault();
      closeTop();
    }
  });
  document.addEventListener('click', e => {
    const closer = e.target.closest('[data-close]');
    if (closer) {
      closeSheet(closer.closest('.sheet-backdrop'));
      return;
    }
    if (e.target.classList?.contains('sheet-backdrop')) closeSheet(e.target);
  });
}

/* ---------- Dialogues dynamiques ---------- */
function buildDialog(inner) {
  const el = document.createElement('div');
  el.className = 'sheet-backdrop sheet-backdrop--dialog';
  el.hidden = true;
  el.innerHTML = `<div class="sheet sheet--dialog" role="alertdialog" aria-modal="true" tabindex="-1">${inner}</div>`;
  document.body.appendChild(el);
  return el;
}

const dispose = el => setTimeout(() => el.remove(), ANIMATION_MS + 50);

/**
 * Confirmation asynchrone.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({ title, message = '', confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false }) {
  return new Promise(resolve => {
    let result = false;
    const el = buildDialog(`
      <div class="dialog__icon ${danger ? 'dialog__icon--danger' : ''}">${icon(danger ? 'trash' : 'info', 22)}</div>
      <h2 class="dialog__title">${esc(title)}</h2>
      ${message ? `<p class="dialog__message">${esc(message)}</p>` : ''}
      <div class="dialog__actions">
        <button type="button" class="btn btn--ghost" data-close>${esc(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-confirm>${esc(confirmLabel)}</button>
      </div>`);
    el.querySelector('[data-confirm]').addEventListener('click', () => {
      result = true;
      closeSheet(el);
    });
    openSheet(el, {
      focus: false,
      onClose: () => {
        dispose(el);
        resolve(result);
      }
    });
    setTimeout(() => el.querySelector('[data-confirm]').focus(), 60);
  });
}

/**
 * Saisie de texte asynchrone (remplace prompt()).
 * @returns {Promise<string|null>}
 */
export function promptDialog({ title, label = '', value = '', placeholder = '', maxLength = 80, confirmLabel = 'Enregistrer' }) {
  return new Promise(resolve => {
    let result = null;
    const el = buildDialog(`
      <form class="dialog__form" novalidate>
        <h2 class="dialog__title">${esc(title)}</h2>
        <div class="field">
          ${label ? `<label class="field__label" for="prompt-input">${esc(label)}</label>` : ''}
          <input id="prompt-input" class="input" name="value" maxlength="${maxLength}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" required>
        </div>
        <div class="dialog__actions">
          <button type="button" class="btn btn--ghost" data-close>Annuler</button>
          <button type="submit" class="btn btn--primary">${esc(confirmLabel)}</button>
        </div>
      </form>`);
    const form = el.querySelector('form');
    const input = form.querySelector('input');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      result = v;
      closeSheet(el);
    });
    openSheet(el, {
      focus: false,
      onClose: () => {
        dispose(el);
        resolve(result);
      }
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 80);
  });
}
