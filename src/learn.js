// Learning layer for the six Grade 2 stages (Family / Body & hygiene / Daily life / Animals / Plants / Market).
//
// Flow per stage (stage select -> intro -> explore -> game -> stamp):
//   find every hotspot of the stage (Rupa Didi names one in Nepali; the hint gives the Tharu word)
//   -> each opens a word card: Tharu (mother tongue) -> Nepali (target) -> English, picture, sentence, facts
//   -> the stage's game (activities.js) -> a stamp in the Village Passport.
// Any stage can be played in any order. Progress is feedback, not a score or a competition.
import { t, L, getLang, toDeva } from './i18n.js';
import { icon, AVATAR } from './icons.js';
import { $, esc, openModal, closeModal } from './ui.js';
import { say, stopVoice } from './audio.js';
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
const SUBJECTS = ['serophero', 'english', 'nepali'];
const CONTENT_LANGS = ['thr', 'ne', 'en'];

/**
 * @param {{ tour: object, refresh: () => void, toast: (msg: string, kind?: string) => void,
 *           onPickStage: (id: string) => void, onLeaveStage: () => void }} ctx
 */
export function createLearning({ tour, refresh, toast, onPickStage, onLeaveStage }) {
  let P = loadProgress();
  let S = null;                 // current stage
  let hint = false;
  let pendingAct = false;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch { /* ignore */ } };
  const W = (id) => tour.words[id];
  const stageById = (id) => tour.stages.find((s) => s.id === id) || null;
  const num = (n) => (getLang() === 'ne' ? toDeva(n) : String(n));
  const tr = (obj) => { const s = L(obj); return s === obj?.ne ? '' : s; };      // translation line (empty in the Nepali UI)

  const items = (s = S) => s.spots.map((sp) => sp.item);
  const foundIn = (s = S) => (P.found[s.id] || []).filter((i) => items(s).includes(i));
  const isFound = (item, s = S) => (P.found[s.id] || []).includes(item);
  const isDone = (s = S) => P.done.includes(s.id);
  const allFound = (s = S) => items(s).every((i) => isFound(i, s));
  const remaining = () => items().filter((i) => !isFound(i));
  const target = () => { const l = remaining(); return l.length ? l[P.skip % l.length] : null; };
  const spotIndex = (item) => { const sp = S.spots.find((x) => x.item === item); return sp ? S.nodes.indexOf(sp.node) + 1 : 0; };

  // ---------------------------------------------------------------- voice (recorded file > browser TTS)
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

  // ---------------------------------------------------------------- stage panel
  function render() {
    if (!S) return;
    const panel = $('#mission');
    panel.style.setProperty('--stage', S.color);
    $('#m-tag').textContent = t('stageN', num(S.n));
    $('#m-title').textContent = L(S.title);
    const nf = foundIn().length, N = items().length, done = isDone();
    const steps = [
      { label: t('stepFind', num(nf), num(N)), done: nf === N },
      { label: t('stepAct', L(S.game)), done },
      { label: t('stepStamp'), done },
    ];
    const cur = steps.findIndex((s) => !s.done);
    $('#m-steps').innerHTML = steps.map((s, i) => `<li class="${s.done ? 'done' : ''}${i === cur ? ' current' : ''}">
      <span class="step-dot">${s.done ? icon('check') : num(i + 1)}</span><span>${esc(s.label)}</span></li>`).join('');
    const ndone = steps.filter((s) => s.done).length;
    $('#m-progress').style.setProperty('--p', `${(ndone / steps.length) * 100}%`);
    $('#m-progress').setAttribute('aria-valuenow', String(ndone));

    const tg = target();
    $('#btn-act').classList.toggle('hidden', !allFound());
    $('#btn-listen').disabled = !tg;
    $('#btn-hint').disabled = !tg;
    $('#btn-other').disabled = remaining().length < 2;
    if (!tg) {
      $('#m-say').textContent = done ? 'स्याबास! धेरै राम्रो!' : 'सबै भेटियो! अब खेलौँ।';
      $('#m-ask').textContent = t(done ? 'stageDone' : 'allFound');
      $('#m-word').innerHTML = '';
      $('#m-hint').classList.add('hidden');
    } else {
      const w = W(tg);
      $('#m-say').textContent = askLine(w);
      $('#m-ask').textContent = t('askFind');
      $('#m-word').innerHTML = `<span class="word" lang="ne">${esc(w.ne)}</span>`;
      $('#m-hint').innerHTML = `<span lang="thr" class="thr-chip">${esc(t('thrLabel'))}</span> ${esc(t('hintText', w.thr, num(spotIndex(tg))))}`;
      $('#m-hint').classList.toggle('hidden', !hint);
    }
    $('#pp-count').textContent = `${num(P.done.length)}/${num(tour.stages.length)}`;
  }

  // ---------------------------------------------------------------- hotspots (called by the viewer)
  const itemState = (item) => (!S || !items().includes(item) ? 'hidden' : isFound(item) ? 'found' : 'active');
  function tapItem(item) {
    const st = itemState(item);
    if (st === 'hidden') return;
    if (st === 'found') { showWord(item, false); return; }
    P.found[S.id] = [...(P.found[S.id] || []), item];
    P.skip = 0; hint = false; save();
    if (allFound() && !isDone()) pendingAct = true;
    render(); refresh();
    showWord(item, true);
  }
  const hintItem = () => (S && hint ? target() : null);
  const pendingNodeIds = () => (S ? S.spots.filter((sp) => !isFound(sp.item)).map((sp) => sp.node) : []);

  // ---------------------------------------------------------------- word card: Tharu -> Nepali -> English
  function showWord(item, isNew) {
    const w = W(item);
    $('#word-card').style.setProperty('--stage', S?.color || 'var(--brick)');
    $('#wc-eyebrow').textContent = isNew ? t('found') : t('wordsLearned');
    $('#wc-eyebrow').classList.toggle('new', isNew);
    $('#wc-media').innerHTML = w.pic ? `<img class="wc-img" src="${esc(w.pic)}" alt="">`
      : w.emoji ? `<div class="wc-sticker" aria-hidden="true">${esc(w.emoji)}</div>`
        : `<img class="wc-img" src="assets/cards/${esc(item)}.jpg" alt="" width="480" height="360">`;
    $('#wc-tri').innerHTML = CONTENT_LANGS.map((lg) => `<div class="tri-row tri-${lg}">
        <span class="tri-lang">${esc(t(`${lg}Label`))}</span>
        ${lg === 'ne' ? `<h3 id="wc-ne" class="tri-word" lang="ne">${esc(w.ne)}</h3>` : `<span class="tri-word" lang="${lg}">${esc(w[lg])}</span>`}
        <button class="icon-btn${lg === 'ne' ? ' primary' : ''}" data-say="${lg}" aria-label="${esc(`${t('listen')}: ${L(tour.langs[lg])}`)}">${icon('volume')}</button></div>`).join('');
    $('#wc-gloss').textContent = getLang() === 'ko' ? `뜻 · ${w.ko}` : '';
    $('#wc-gloss').classList.toggle('hidden', getLang() !== 'ko');
    $('#wc-say').innerHTML = w.say ? `<div class="expr-row"><p lang="ne">${esc(w.say.ne)}</p>
        <button class="icon-btn" data-say="sentence" aria-label="${esc(t('listen'))}">${icon('volume')}</button></div>
        ${tr(w.say) ? `<p class="muted">${esc(tr(w.say))}</p>` : ''}` : '';
    $('#wc-say').classList.toggle('hidden', !w.say);
    $('#wc-facts').innerHTML = (w.facts || []).map((f) => `<div class="fact"><dt>${esc(t('fact')[f.k] || f.k)}</dt>
        <dd><span lang="ne">${esc(f.v.ne)}</span>${tr(f.v) ? ` <small>${esc(tr(f.v))}</small>` : ''}</dd></div>`).join('');
    $('#wc-note').textContent = `${t('thrDraft')}: ${t('thrSrc')[w.thrSrc] || '?'} · ${t('ttsNote')}`;
    $('#wc-tri').onclick = (e) => {
      const b = e.target.closest('[data-say]');
      if (!b) return;
      const lg = b.dataset.say;
      const how = speak({ text: w[lg], lang: lg, key: item }, { quiet: false });
      if (how === 'approx') toast(t('approxThr'), 'info');
    };
    $('#wc-say').onclick = (e) => { if (e.target.closest('[data-say]')) speak({ text: w.say.ne, lang: 'ne', key: `${item}.say` }, { quiet: false }); };
    openModal($('#word-card'), '#wc-ok');
    speak({ text: w.ne, lang: 'ne', key: item });
  }
  function closeWord() {
    stopVoice();
    closeModal($('#word-card'));
    if (pendingAct) { pendingAct = false; setTimeout(openActivity, 300); return; }
    setTimeout(() => sayTarget(), 250);
  }

  // ---------------------------------------------------------------- stage game -> stamp
  const activities = createActivities({
    tour,
    speak: (o) => speak(o),
    onFinish: (stage, result) => {
      const first = !P.done.includes(stage.id);
      const prev = P.acts[stage.id];
      P.acts = { ...P.acts, [stage.id]: !prev || result.correct > prev.correct ? result : prev };   // a replay keeps the best try
      if (first) P.done = [...P.done, stage.id];
      save();
      render(); refresh();
      openPassport({ stamped: first ? stage : null, back: true });
    },
  });
  function openActivity() { if (S && allFound()) activities.open(S); }

  // ---------------------------------------------------------------- passport (stamps + learning summary for teachers)
  function openPassport({ stamped = null, back = false } = {}) {
    $('#pp-stamps').innerHTML = tour.stages.map((s) => {
      const done = P.done.includes(s.id);
      const started = foundIn(s).length > 0;
      return `<div class="stamp ${done ? 'done' : started ? 'open' : ''}${stamped?.id === s.id ? ' fresh' : ''}" style="--stage:${esc(s.color)}">
        <div class="stamp-ring"><span class="emo">${esc(s.emoji)}</span></div>
        <strong>${esc(L(s.title))}</strong>
        <small>${done ? t('done') : started ? t('inProgress', num(foundIn(s).length), num(items(s).length)) : t('notStarted')}</small></div>`;
    }).join('');
    const allDone = tour.stages.every((s) => P.done.includes(s.id));
    const msg = stamped ? `${t('stampGot', L(stamped.title))} ${allDone ? t('allDone') : ''}` : '';
    $('#pp-msg').textContent = msg;
    $('#pp-msg').classList.toggle('hidden', !msg);
    const words = tour.stages.flatMap((s) => foundIn(s));
    $('#pp-words').innerHTML = words.length
      ? words.map((id) => `<li><button class="word-chip" data-id="${esc(id)}" aria-label="${esc(`${W(id).ne} ${t('listen')}`)}">${icon('volume')}
          <span lang="ne">${esc(W(id).ne)}</span><small lang="thr">${esc(W(id).thr)}</small></button></li>`).join('')
      : `<li class="muted">${esc(t('noWords'))}</li>`;
    $('#pp-words').onclick = (e) => { const b = e.target.closest('.word-chip'); if (b) speak({ text: W(b.dataset.id).ne, lang: 'ne', key: b.dataset.id }, { quiet: false }); };
    $('#pp-acts').innerHTML = tour.stages.filter((s) => P.acts[s.id])
      .map((s) => `<li>${esc(t('actResult', L(s.game), num(P.acts[s.id].correct), num(P.acts[s.id].total)))}</li>`).join('');
    $('#pp-stages').classList.toggle('hidden', !back);
    openModal($('#passport'), back ? '#pp-stages' : '#pp-close');
  }

  // ---------------------------------------------------------------- stage select (landing)
  function renderLanding() {
    $('#stage-grid').innerHTML = tour.stages.map((s) => {
      const nf = foundIn(s).length, N = items(s).length, done = isDone(s);
      const has3d = s.nodes.some((id) => tour.nodes.find((n) => n.id === id)?.media === '3dgs');
      const status = done ? t('done') : nf ? t('inProgress', num(nf), num(N)) : t('notStarted');
      return `<li><button class="stage-card${done ? ' is-done' : nf ? ' is-open' : ''}" data-stage="${esc(s.id)}" style="--stage:${esc(s.color)}">
        <span class="sc-top"><span class="sc-num">${esc(t('stageN', num(s.n)))}</span>${has3d ? '<span class="media-tag kind-3d">3D</span>' : ''}</span>
        <span class="sc-emoji" aria-hidden="true">${esc(s.emoji)}</span>
        <span class="sc-title">${esc(L(s.title))}</span>
        ${getLang() !== 'ne' ? `<span class="sc-ne" lang="ne">${esc(s.title.ne)}</span>` : ''}
        <span class="sc-game">${icon('play')}<span>${esc(L(s.game))}</span></span>
        <span class="sc-status">${done ? icon('award') : ''}<span>${esc(status)}</span></span></button></li>`;
    }).join('');
    const started = P.done.length || Object.values(P.found).some((l) => l.length);
    $('#btn-reset').classList.toggle('hidden', !started);
    $('#guide-hello').textContent = tour.guide.hello.ne;
    $('#guide-hello-tr').textContent = tr(tour.guide.hello);
  }
  $('#stage-grid').addEventListener('click', (e) => { const b = e.target.closest('.stage-card'); if (b) onPickStage(b.dataset.stage); });

  // ---------------------------------------------------------------- stage intro (goal + linked subjects, for teachers too)
  function showIntro() {
    if (!S) return;
    $('#stage-intro').style.setProperty('--stage', S.color);
    $('#si-emoji').textContent = S.emoji;
    $('#si-tag').textContent = t('stageN', num(S.n));
    $('#si-title').textContent = L(S.title);
    $('#si-title-ne').textContent = getLang() !== 'ne' ? S.title.ne : '';
    $('#si-game').textContent = L(S.game);
    $('#si-place').textContent = L(S.place);
    $('#si-goal').textContent = L(S.goal);
    $('#si-subjects').innerHTML = SUBJECTS.map((k) => `<li><b>${esc(t('subj')[k])}</b> ${esc(L(S.subjects[k]))}</li>`).join('');
    openModal($('#stage-intro'), '#si-start');
    speak({ text: `${S.title.ne}। ${S.game.ne}।`, lang: 'ne', key: `${S.id}.title` });
  }
  $('#si-start').addEventListener('click', () => { closeModal($('#stage-intro')); sayTarget(); });
  $('#si-back').addEventListener('click', () => { closeModal($('#stage-intro')); onLeaveStage(); });

  function setStage(id) { S = stageById(id); hint = false; pendingAct = false; P.skip = 0; render(); }
  function reset() { P = fresh(); hint = false; save(); render(); renderLanding(); }

  // ---------------------------------------------------------------- wiring
  $('#btn-listen').addEventListener('click', () => sayTarget({ quiet: false }));
  $('#btn-hint').addEventListener('click', () => {
    const tg = target();
    if (!tg) return;
    hint = true; render(); refresh();
    const how = speak({ text: W(tg).thr, lang: 'thr', key: tg }, { quiet: false });
    if (how === 'approx') toast(t('approxThr'), 'info');
  });
  $('#btn-other').addEventListener('click', () => { P.skip++; hint = false; save(); render(); refresh(); sayTarget(); });
  $('#btn-act').addEventListener('click', openActivity);
  $('#wc-ok').addEventListener('click', closeWord);
  $('#pp-close').addEventListener('click', () => closeModal($('#passport')));
  $('#pp-stages').addEventListener('click', () => { closeModal($('#passport')); onLeaveStage(); });
  $('#m-collapse').addEventListener('click', () => {
    const c = $('#mission').classList.toggle('collapsed');
    $('#m-collapse').setAttribute('aria-expanded', String(!c));
  });
  $('#guide-avatar').innerHTML = AVATAR;
  $('#landing-avatar').innerHTML = AVATAR;
  $('#guide-hello-listen').addEventListener('click', () => speak({ text: tour.guide.hello.ne, lang: 'ne', key: 'guide.hello' }, { quiet: false }));

  return {
    render, renderLanding, itemState, tapItem, hintItem, pendingNodeIds, openPassport, closeWord, sayTarget,
    showIntro, setStage, reset, stage: () => S,
  };
}
