// Voices for the learning content.
// A recorded file wins (tour.audio[lang][key] <- assets/audio/<lang>/<key>.mp3, indexed by make_splats.py);
// otherwise the browser's TTS. No browser has a Tharu voice, so until Tharu recordings exist a Tharu word is
// read by a Nepali (or Hindi) voice as a rough stand-in (say() returns 'approx'; the UI does not show it).
const PREF = { ne: ['ne', 'hi'], thr: ['ne', 'hi'], en: ['en-us', 'en'] };
let voices = [];
let files = {};
let player = null;

const refreshVoices = () => { voices = window.speechSynthesis?.getVoices?.() || []; };
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
}
const pickVoice = (lang) => {
  for (const p of PREF[lang] || [lang]) {
    const v = voices.find((x) => x.lang.toLowerCase().replace('_', '-').startsWith(p));
    if (v) return v;
  }
  return null;
};

/** @param {Record<string, Record<string, string>>} index  {lang: {key: url}} from tour.json */
export function setAudioIndex(index) { files = index || {}; }

export function stopVoice() {
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  if (player) { player.pause(); player = null; }
}

function tts(text, lang, rate) {
  if (!text || !('speechSynthesis' in window)) return false;
  const v = pickVoice(lang);
  if (!v && voices.length) return false;            // voices are known and none fits: never read Devanagari with an English voice
  const u = new SpeechSynthesisUtterance(text);
  u.lang = v?.lang || (lang === 'en' ? 'en-US' : 'ne-NP');
  u.rate = rate;
  if (v) u.voice = v;
  speechSynthesis.speak(u);
  return lang === 'thr' ? 'approx' : 'tts';
}

/**
 * Speak one piece of content.
 * @param {{ text: string, lang: 'ne'|'thr'|'en', key?: string, rate?: number }} o
 * @returns {'file'|'tts'|'approx'|false}  how it is being played (false = no voice available)
 */
export function say({ text, lang, key, rate = 0.85 }) {
  stopVoice();
  const url = key && files[lang]?.[key];
  if (url) {
    const a = new Audio(url);
    player = a;
    a.addEventListener('error', () => { if (player === a) { player = null; tts(text, lang, rate); } }, { once: true });
    a.play().catch(() => { if (player === a) { player = null; tts(text, lang, rate); } });
    return 'file';
  }
  return tts(text, lang, rate);
}
