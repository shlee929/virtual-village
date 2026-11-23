// Emoji as picture files (assets/emoji, made by tools/make_emoji.py), so a picture looks the same and keeps
// the same box on every phone and browser. If a file is missing, the device's own emoji is shown instead.
import { esc } from './ui.js';

/** @param {string} e @returns {string} file name: code points in hex joined with "-", without the fe0f selector */
export const emojiCode = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).filter((x) => x !== 'fe0f').join('-');

/** @param {string} e @returns {string} HTML for the picture (1em square; decorative, so no alt text) */
export const emojiImg = (e) => (e ? `<img class="emo-img" src="assets/emoji/${emojiCode(e)}.webp" data-emoji="${esc(e)}" alt="" draggable="false">` : '');

// load errors do not bubble, so listen in the capture phase
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.emoji) return;
  const text = document.createElement('span');
  text.className = 'emo-text';
  text.setAttribute('aria-hidden', 'true');
  text.textContent = img.dataset.emoji;
  img.replaceWith(text);
}, true);
