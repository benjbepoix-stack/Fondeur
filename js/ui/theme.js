/*
 * Thème : automatique (suit l'iPhone), clair ou sombre, avec transition
 * fluide et barre d'état iOS assortie.
 */
import { $ } from '../core/utils.js';
import { icon } from './icons.js';

const THEME_COLORS = { dark: '#0b1220', light: '#f4f8fb' };
const LABELS = { auto: 'automatique', light: 'clair', dark: 'sombre' };
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

let preference = 'auto';

export const systemTheme = () => (systemDark.matches ? 'dark' : 'light');
export const resolvedTheme = (pref = preference) => (pref === 'auto' ? systemTheme() : pref);
export const themeLabel = pref => LABELS[pref] || LABELS.auto;

/**
 * Choix suivant au toucher du bouton : chaque étape change ce qu'on voit,
 * sauf le retour en automatique (signalé par l'icône et un message).
 * Ex. iPhone en clair : auto → sombre → clair → auto.
 */
export function nextTheme(pref = preference) {
  const sys = systemTheme();
  const other = sys === 'dark' ? 'light' : 'dark';
  if (pref === 'auto') return other;
  if (pref === other) return sys;
  return 'auto';
}

export function applyTheme(pref, { animate = false } = {}) {
  preference = LABELS[pref] ? pref : 'auto';
  const theme = resolvedTheme();
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-transition');
    setTimeout(() => root.classList.remove('theme-transition'), 450);
  }
  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
  const btn = $('#themeToggle');
  if (btn) {
    btn.innerHTML = icon(preference === 'auto' ? 'contrast' : theme === 'light' ? 'sun' : 'moon', 20);
    btn.setAttribute('aria-label', `Thème ${LABELS[preference]} · changer de thème`);
  }
}

/** Suit les changements clair / sombre de l'iPhone tant que le thème est automatique. */
export function watchSystemTheme(onChange) {
  systemDark.addEventListener('change', () => {
    if (preference !== 'auto') return;
    applyTheme('auto', { animate: true });
    onChange?.();
  });
}
