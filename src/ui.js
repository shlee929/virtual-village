// Small DOM helpers shared by the viewer, the learning layer and the stage games.
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

// ---------------------------------------------------------------- modals (focus in, Esc, focus back)
const modalStack = [];
export function openModal(el, focusSel) {
  if (!el.classList.contains('hidden')) return;
  modalStack.push({ el, back: document.activeElement });
  el.classList.remove('hidden');
  requestAnimationFrame(() => (el.querySelector(focusSel || '[data-autofocus]') || el.querySelector('button'))?.focus());
}
export function closeModal(el) {
  if (el.classList.contains('hidden')) return;
  el.classList.add('hidden');
  const i = modalStack.findIndex((m) => m.el === el);
  if (i >= 0) { const [m] = modalStack.splice(i, 1); m.back?.focus?.(); }
}
export const topModal = () => modalStack.at(-1)?.el || null;
