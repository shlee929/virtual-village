// Learning layer for the six Grade 2 stages (Family / Body & hygiene / Daily life / Animals / Plants / Market).
//
// Flow per stage (stage select -> intro -> explore -> game -> stamp):
//   find every hotspot of the stage (the panel shows the picture and Nepali name of one; the hint gives the Tharu word)
//   -> each opens a word card: Tharu (mother tongue) -> Nepali (target) -> English, picture, sentence, facts;
//      the word counts as found (check mark) once its Nepali word and sentence have been listened to
//   -> the stage's game (activities.js) -> a stamp in the Village Passport as soon as the game is finished.
// Any stage can be played in any order. Progress is shown as dots and stamps, not as a score.
// Shown text is kept to a minimum: Nepali words, plus their meaning when the UI is English or Korean.
import { t, L, getLang, toDeva } from './i18n.js';
import { icon } from './icons.js';
import { $, esc, openModal, closeModal } from './ui.js';
import { say, stopVoice } from './audio.js';
import { emojiImg } from './emoji.js';
import { createActivities } from './activities.js';

const KEY = 'vv.progress';
const fresh = () => ({ found: {}, done: [], acts: {}, skip: 0 });
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
// stored progress is untrusted (older builds, hand edits): keep only well-formed fields
function loadProgress() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* storage blocked or corrupt */ }
  if (!isObj(raw)) raw = {};
  const found = {};
  if (isObj(raw.found)) for (const [k, v] of Object.entries(raw.found)) if (Array.isArray(v)) found[k] = v.filter((x) => typeof x === 'string');
  const acts = {};
  if (isObj(raw.acts)) for (const [k, v] of Object.entries(raw.acts)) if (isObj(v) && Number.isFinite(v.correct) && Number.isFinite(v.total)) acts[k] = v;
  return { found, acts, done: Array.isArray(raw.done) ? raw.done.filter((x) => typeof x === 'string') : [], skip: 0 };
}
const CONTENT_LANGS = ['thr', 'ne', 'en'];
// word-card facts get a picture instead of a text label (the label stays as a tooltip)
const FACT_ICON = { baby: '🍼', food: '🍽️', home: '🏠', sound: '🔊', move: '🐾', group: '🥗', unit: '⚖️', days: '📅', posture: '🧍' };

/**
 * @param {{ tour: object, refresh: () => void, toast: (msg: string, kind?: string) => void,
 *           onPickStage: (id: string) => void, onLeaveStage: () => void }} ctx
 */
export function createLearning({ tour, refresh, toast, onPickStage, onLeaveStage }) {
  let P = loadProgress();
  let S = null;                 // current stage
  let hint = false;
  let newStamp = null;          // the stage whose stamp was just earned in the open game
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ } };
  const W = (id) => tour.words[id];
  const stageById = (id) => tour.stages.find((s) => s.id === id) || null;
  const num = (n) => (getLang() === 'ne' ? toDeva(n) : String(n));
  const tr = (obj) => { const s = L(obj); return s === obj?.ne ? '' : s; };      // meaning line (empty in the Nepali UI)
  const trLine = (obj) => (tr(obj) ? `<span class="tr-line">${esc(tr(obj))}</span>` : '');
  // the picture of a word: its 2D sticker, or the photo cut-out for real objects in the 360 photo
  const pic = (id) => {
    const w = W(id);
    return w.pic ? `<img src="${esc(w.pic)}" alt="">` : w.emoji ? emojiImg(w.emoji) : `<img src="assets/cards/${esc(id)}.jpg" alt="">`;
  };

  const items = (s = S) => s.spots.map((sp) => sp.item);
  const foundIn = (s = S) => (P.found[s.id] || []).filter((i) => items(s).includes(i));
  const isFound = (item, s = S) => (P.found[s.id] || []).includes(item);
  const isDone = (s = S) => P.done.includes(s.id);
  const allFound = (s = S) => items(s).every((i) => isFound(i, s));
  const remaining = () => items().filter((i) => !isFound(i));
  const target = () => { const l = remaining(); return l.length ? l[P.skip % l.length] : null; };
  const spotIndex = (item) => { const sp = S.spots.find((x) => x.item === item); return sp ? S.nodes.indexOf(sp.node) + 1 : 0; };
  const statusOf = (s) => (isDone(s) ? t('done') : foundIn(s).length ? t('inProgress', num(foundIn(s).length), num(items(s).length)) : t('notStarted'));
  const dotsLine = (s) => `<span class="dots-line" aria-hidden="true">${items(s).map((i) => `<i class="${isFound(i, s) ? 'on' : ''}"></i>`).join('')}</span>`;

  // ---------------------------------------------------------------- voice (recorded file > browser TTS)
  // Nothing speaks on its own: the voice plays only when a 🔊 button or the picture in the panel is pressed
  // (and, inside a game, in answer to a tap).
  function speak({ text, lang, key }, { quiet = true } = {}) {
    const how = say({ text, lang, key });
    if (!how && !quiet) toast(t('noVoice', L(tour.langs[lang])), 'warn');
    return how;
  }
  const askLine = (w) => (w.person ? `${w.ne} कहाँ हुनुहुन्छ?` : `${w.ne} कहाँ छ?`);
  function sayTarget({ quiet = true } = {}) {
    const tg = S && target();
    if (tg) speak({ text: askLine(W(tg)), lang: 'ne', key: `${tg}.ask` }, { quiet });
  }

  // ---------------------------------------------------------------- stage panel: dots, the word to find, hint
  function render() {
    if (!S) return;
    $('#mission').style.setProperty('--stage', S.color);
    $('#m-emoji').innerHTML = emojiImg(S.emoji);
    $('#m-title').textContent = L(S.title);
    const tg = target();
    $('#m-dots').innerHTML = items().map((id) => {
      const f = isFound(id);
      return `<li class="${f ? 'found' : id === tg ? 'current' : ''}">${f ? pic(id) : ''}</li>`;
    }).join('');
    $('#m-dots').setAttribute('aria-label', t('inProgress', num(foundIn().length), num(items().length)));
    $('#btn-act').classList.toggle('hidden', !allFound());
    $('#btn-hint').classList.toggle('hidden', !tg);
    $('#btn-other').classList.toggle('hidden', !tg);
    $('#btn-other').disabled = remaining().length < 2;
    // the picture is the word to find; once everything is found it gives way to a sentence (the play button is below)
    $('#btn-listen').classList.toggle('hidden', !tg);
    if (!tg) {
      $('#m-word').innerHTML = `<span class="m-done">${esc(L(S.foundAll))}</span>`;
      $('#m-hint').classList.add('hidden');
    } else {
      const w = W(tg);
      $('#m-pic').innerHTML = pic(tg);
      $('#m-word').innerHTML = `<span class="w" lang="ne">${esc(w.ne)}</span>${trLine(w)}`;
      const spot = S.nodes.length > 1 ? `<span class="spot">${icon('pin')}${esc(num(spotIndex(tg)))}</span>` : '';
      $('#m-hint').innerHTML = `<span class="tag">${esc(t('thrLabel'))}</span><b lang="thr">${esc(w.thr)}</b>${spot}`;
      $('#m-hint').classList.toggle('hidden', !hint);
    }
    $('#pp-count').textContent = `${num(P.done.length)}/${num(tour.stages.length)}`;
  }

  // ---------------------------------------------------------------- hotspots (called by the viewer)
  const itemState = (item) => (!S || !items().includes(item) ? 'hidden' : isFound(item) ? 'found' : 'active');
  function tapItem(item) {
    if (itemState(item) !== 'hidden') showWord(item);
  }
  function markFound(item) {
    if (!S || isFound(item)) return;
    P.found = { ...P.found, [S.id]: [...(P.found[S.id] || []), item] };
    P.skip = 0; hint = false; save();
    render(); refresh();
  }
  const hintItem = () => (S && hint ? target() : null);
  const pendingNodeIds = () => (S ? S.spots.filter((sp) => !isFound(sp.item)).map((sp) => sp.node) : []);

  // ---------------------------------------------------------------- word card: picture | Tharu -> Nepali -> English
  function showWord(item) {
    const w = W(item);
    $('#word-card').style.setProperty('--stage', S?.color || 'var(--coral)');
    $('#wc-media').innerHTML = w.figure ? `<img class="wc-figure" src="${esc(w.figure)}" alt="">`
      : w.pic ? `<img class="wc-img" src="${esc(w.pic)}" alt="">`
      : w.emoji ? `<div class="wc-sticker" aria-hidden="true">${emojiImg(w.emoji)}</div>`
        : `<img class="wc-img" src="assets/cards/${esc(item)}.jpg" alt="" width="480" height="360">`;
    const gloss = getLang() === 'ko' && w.ko ? ` <small>${esc(w.ko)}</small>` : '';
    $('#wc-tri').innerHTML = CONTENT_LANGS.map((lg) => `<div class="tri-row tri-${lg}">
        <span class="tag">${esc(t(`${lg}Label`))}</span>
        ${lg === 'ne' ? `<h3 id="wc-ne" class="tri-word" lang="ne">${esc(w.ne)}</h3>`
          : `<span class="tri-word" lang="${lg}">${esc(w[lg])}${lg === 'en' ? gloss : ''}</span>`}
        <button class="icon-btn" data-say="${lg}" aria-label="${esc(`${t('listen')}: ${L(tour.langs[lg])}`)}">${icon('volume')}</button></div>`).join('');
    $('#wc-say').innerHTML = w.say ? `<p lang="ne">${esc(w.say.ne)}</p>
        <button class="icon-btn" data-say="sentence" aria-label="${esc(t('listen'))}">${icon('volume')}</button>${trLine(w.say)}` : '';
    $('#wc-facts').innerHTML = (w.facts || []).map((f) => `<li title="${esc(t('fact')[f.k] || f.k)}">
        <span class="emo" aria-hidden="true">${FACT_ICON[f.k] ? emojiImg(FACT_ICON[f.k]) : '•'}</span><span lang="ne">${esc(f.v.ne)}</span>${tr(f.v) ? `<small>${esc(tr(f.v))}</small>` : ''}</li>`).join('');
    wireListening(item, w);
    openModal($('#word-card'), isFound(item) ? '#wc-ok' : '.need');
  }
  // The check mark appears once the Nepali word and its sentence have been listened to (Tharu and English are optional).
  // A press counts even when the device has no Nepali voice, so a child is never stuck.
  function wireListening(item, w) {
    const toHear = new Set(isFound(item) ? [] : ['ne', ...(w.say ? ['sentence'] : [])]);
    const button = (id) => $(`[data-say="${id}"]`, $('#word-card'));
    toHear.forEach((id) => button(id).classList.add('need'));
    $('#wc-ok').classList.toggle('hidden', toHear.size > 0);
    const onSay = (e) => {
      const id = e.target.closest('[data-say]')?.dataset.say;
      if (!id) return;
      speak(id === 'sentence' ? { text: w.say.ne, lang: 'ne', key: `${item}.say` } : { text: w[id], lang: id, key: item }, { quiet: false });
      if (!toHear.delete(id)) return;
      button(id).classList.replace('need', 'heard');
      if (toHear.size) return;
      markFound(item);
      $('#wc-ok').classList.remove('hidden');
      $('#wc-ok').focus();                       // also scrolls it into view and announces it
    };
    $('#wc-tri').onclick = onSay;
    $('#wc-say').onclick = onSay;
  }
  function closeWord() {
    stopVoice();
    closeModal($('#word-card'));
  }

  // ---------------------------------------------------------------- stage game -> stamp
  const activities = createActivities({
    tour,
    speak: (o) => speak(o),
    // the stamp counts the moment the game is finished, however its window is closed afterwards
    onComplete: (stage, result) => {
      const prev = P.acts[stage.id];
      P.acts = { ...P.acts, [stage.id]: !prev || result.correct > prev.correct ? result : prev };   // a replay keeps the best try
      newStamp = P.done.includes(stage.id) ? null : stage;
      if (newStamp) P.done = [...P.done, stage.id];
      save();
      render(); refresh();
    },
    onFinish: () => openPassport({ stamped: newStamp, back: true }),
  });
  function openActivity() { if (S && allFound()) activities.open(S); }

  // ---------------------------------------------------------------- passport: stamps + the words found so far
  function openPassport({ stamped = null, back = false } = {}) {
    $('#pp-stamps').innerHTML = tour.stages.map((s) => {
      const cls = isDone(s) ? 'done' : foundIn(s).length ? 'open' : '';
      return `<li class="stamp ${cls}${stamped?.id === s.id ? ' fresh' : ''}" style="--stage:${esc(s.color)}" title="${esc(`${L(s.title)} · ${statusOf(s)}`)}">
        <span class="stamp-ring"><span class="emo" aria-hidden="true">${emojiImg(s.emoji)}</span></span>
        <span class="sr-only">${esc(`${L(s.title)}: ${statusOf(s)}`)}</span>${dotsLine(s)}</li>`;
    }).join('');
    const allDone = tour.stages.every((s) => P.done.includes(s.id));
    const msg = stamped ? `${t('stampGot', L(stamped.title))} ${allDone ? t('allDone') : ''}` : '';
    $('#pp-msg').textContent = msg;
    $('#pp-msg').classList.toggle('hidden', !msg);
    const words = tour.stages.flatMap((s) => foundIn(s));
    $('#pp-words').innerHTML = words.map((id) => `<li><button class="word-chip" data-id="${esc(id)}" aria-label="${esc(`${W(id).ne} · ${t('listen')}`)}">
        <span class="emo" aria-hidden="true">${pic(id)}</span><span lang="ne">${esc(W(id).ne)}</span>${tr(W(id)) ? `<small>${esc(tr(W(id)))}</small>` : ''}</button></li>`).join('');
    $('#pp-words').onclick = (e) => { const b = e.target.closest('.word-chip'); if (b) speak({ text: W(b.dataset.id).ne, lang: 'ne', key: b.dataset.id }, { quiet: false }); };
    $('#pp-stages').classList.toggle('hidden', !back);
    openModal($('#passport'), back ? '#pp-stages' : '#pp-close');
  }

  // ---------------------------------------------------------------- stage select (landing)
  function renderLanding() {
    $('#stage-grid').innerHTML = tour.stages.map((s) => `<li>
      <button class="stage-card${isDone(s) ? ' is-done' : ''}" data-stage="${esc(s.id)}" style="--stage:${esc(s.color)}"
        aria-label="${esc(`${t('stageN', num(s.n))}: ${L(s.title)} · ${statusOf(s)}`)}">
        <span class="sc-art"><span class="sc-num">${esc(num(s.n))}</span>
          <span class="sc-emoji" aria-hidden="true">${emojiImg(s.emoji)}</span>${isDone(s) ? `<span class="sc-stamp">${icon('award')}</span>` : ''}</span>
        <span class="sc-body"><span class="sc-title" lang="ne">${esc(s.title.ne)}</span>${tr(s.title) ? `<span class="sc-tr">${esc(tr(s.title))}</span>` : ''}${dotsLine(s)}</span>
      </button></li>`).join('');
    const started = P.done.length || Object.values(P.found).some((l) => l.length);
    $('#btn-reset').classList.toggle('hidden', !started);
    $('#land-pp-count').textContent = `${num(P.done.length)}/${num(tour.stages.length)}`;
  }
  $('#stage-grid').addEventListener('click', (e) => { const b = e.target.closest('.stage-card'); if (b) onPickStage(b.dataset.stage); });

  // ---------------------------------------------------------------- stage intro: picture, title, what to find
  function showIntro() {
    if (!S) return;
    $('#stage-intro').style.setProperty('--stage', S.color);
    $('#si-emoji').innerHTML = emojiImg(S.emoji);
    $('#si-title').textContent = S.title.ne;
    $('#si-tr').textContent = tr(S.title);
    $('#si-items').innerHTML = items().map((id) => `<li>${pic(id)}</li>`).join('');
    openModal($('#stage-intro'), '#si-start');
  }
  $('#si-start').addEventListener('click', () => closeModal($('#stage-intro')));
  $('#si-back').addEventListener('click', () => { closeModal($('#stage-intro')); onLeaveStage(); });

  function setStage(id) { S = stageById(id); hint = false; P.skip = 0; render(); }
  function reset() { P = fresh(); hint = false; save(); render(); renderLanding(); }
  // another tab changed or cleared the progress: follow it, so this tab does not write its older copy back later
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return;
    P = loadProgress(); hint = false;
    render(); renderLanding();
    if (S) refresh();
  });

  // ---------------------------------------------------------------- wiring
  $('#btn-listen').addEventListener('click', () => sayTarget({ quiet: false }));      // "where is ...?" in Nepali
  $('#btn-hint').addEventListener('click', () => {
    const tg = target();
    if (!tg) return;
    hint = true; render(); refresh();
    speak({ text: W(tg).thr, lang: 'thr', key: tg }, { quiet: false });
  });
  $('#btn-other').addEventListener('click', () => { P.skip++; hint = false; save(); render(); refresh(); });
  $('#btn-act').addEventListener('click', openActivity);
  $('#wc-ok').addEventListener('click', closeWord);
  $('#wc-close').addEventListener('click', closeWord);
  $('#pp-close').addEventListener('click', () => closeModal($('#passport')));
  $('#pp-stages').addEventListener('click', () => { closeModal($('#passport')); onLeaveStage(); });

  return {
    render, renderLanding, itemState, tapItem, hintItem, pendingNodeIds, openPassport, closeWord,
    showIntro, setStage, reset, stage: () => S,
  };
}
