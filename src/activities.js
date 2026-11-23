// Stage games: the "Proposed Game / Software Feature" column of the Grade 2 Game ideas. A stage's game
// opens once every hotspot of that stage has been found.
//   match : several questions; each shows one sentence card and a few word cards, and the child picks the word
//           card the sentence belongs to (who does what / tool -> body part / routine -> clock / animal -> home)
//   grow  : plant a seed, water it, then touch the plant parts (root, stem, leaf, flower)
//   count : fill the basket from a shopping list, counting in Nepali, then "how many in all?"
// Everything is a <button>, so Tab + Enter works too.
import { t, L, getLang, toDeva, NE_NUM, I18N } from './i18n.js';
import { icon } from './icons.js';
import { emojiImg } from './emoji.js';
import { $, $$, esc, shuffle, openModal, closeModal } from './ui.js';

const CHOICES = 4;             // word cards per question
const EXTRA_IN_STALL = 5;      // decoys in the market stall, so children have to stop at the right number
// Spoken guide lines (Nepali is the target language, so the voice is always Nepali)
const SAY_NE = {
  seed: 'बिउ रोप्यौ। अब पानी हाल।',
  grown: 'बिरुवा हुर्कियो! अब बिरुवाका भाग छोऊ।',
};

function clockSVG(hour) {
  const a = ((hour % 12) / 12) * 2 * Math.PI;
  const p = (r, ang) => [(32 + r * Math.sin(ang)).toFixed(1), (32 - r * Math.cos(ang)).toFixed(1)];
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const b = (i / 12) * 2 * Math.PI, [x1, y1] = p(i % 3 ? 25 : 22, b), [x2, y2] = p(27, b);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }).join('');
  const [hx, hy] = p(14, a);
  return `<svg class="clock" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><circle cx="32" cy="32" r="29" class="face"/>
    <g class="ticks">${ticks}</g><line class="hand-m" x1="32" y1="32" x2="32" y2="11"/>
    <line class="hand-h" x1="32" y1="32" x2="${hx}" y2="${hy}"/><circle cx="32" cy="32" r="2.6" class="pin"/></svg>`;
}

// s: 0 bare soil, 1 seed, 2 sprout, 3 young plant, 4 grown with a flower
function plantSVG(s) {
  const top = { 2: 125, 3: 92, 4: 58 }[Math.min(s, 4)] ?? 150;
  const root = { 2: 16, 3: 32, 4: 52 }[Math.min(s, 4)] ?? 0;
  let g = '<rect width="220" height="150" class="g-sky"/><circle cx="186" cy="30" r="15" class="g-sun"/>'
    + '<rect y="148" width="220" height="92" class="g-soil"/><rect y="146" width="220" height="7" rx="3" class="g-ground"/>';
  if (s === 1) g += '<ellipse cx="110" cy="168" rx="8" ry="5.5" class="g-seed"/>';
  if (s >= 2) {
    g += `<g class="g-root"><path d="M110 153 q-3 ${root * 0.5} -${(root * 0.55).toFixed(1)} ${root}"/>`
      + `<path d="M110 153 q4 ${root * 0.6} ${(root * 0.5).toFixed(1)} ${(root * 0.95).toFixed(1)}"/><path d="M110 153 v${(root * 1.05).toFixed(1)}"/></g>`;
    g += `<line x1="110" y1="153" x2="110" y2="${top}" class="g-stem"/>`;
    const pairs = Math.min(s, 4) - 1;
    for (let i = 0; i < pairs; i++) {
      const y = (150 - (150 - top) * (0.32 + 0.2 * i)).toFixed(1);
      g += `<path d="M110 ${y} q-22 -15 -36 -3 q17 15 36 3z" class="g-leaf"/><path d="M110 ${y - 7} q22 -15 36 -3 q-17 15 -36 3z" class="g-leaf"/>`;
    }
  }
  if (s >= 4) {
    g += '<g class="g-flower">' + Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * 2 * Math.PI;
      return `<circle cx="${(110 + 11 * Math.cos(a)).toFixed(1)}" cy="${(top - 4 + 11 * Math.sin(a)).toFixed(1)}" r="8"/>`;
    }).join('') + `</g><circle cx="110" cy="${top - 4}" r="6.5" class="g-flower-c"/>`;
  }
  return g;
}
// where the part labels sit on the grown plant (% of the 220x240 garden)
const PART_POS = { root: [50, 80], stem: [50, 55], leaf: [30, 46], flower: [50, 21] };

/**
 * onComplete: the game has been finished (called once, while its window is still open);
 * onFinish: the child then pressed the stamp button.
 * @param {{ tour: object, speak: (o: {text: string, lang: string, key?: string}) => unknown,
 *           onComplete: (stage: object, result: {correct: number, total: number}) => void, onFinish: () => void }} ctx
 */
export function createActivities({ tour, speak, onComplete, onFinish }) {
  const W = (id) => tour.words[id];
  const body = () => $('#act-body');
  let run = null;                       // { stage, act, correct, total }
  const sayNe = (text, key) => speak({ text, lang: 'ne', key });
  const num = (n) => (getLang() === 'ne' ? toDeva(n) : String(n));
  const tr = (obj) => { const s = L(obj); return s === obj?.ne ? '' : s; };     // translation line, empty in the Nepali UI
  const emo = (e) => `<span class="emo">${emojiImg(e)}</span>`;
  const art = (w, id) => (w.pic ? `<img src="${esc(w.pic)}" alt="">` : w.emoji ? emo(w.emoji) : `<img src="assets/cards/${esc(id)}.jpg" alt="">`);
  function feedback(msg, kind = '') { const f = $('#act-feedback'); f.textContent = msg; f.className = `feedback ${kind}`; }
  function complete() {
    feedback(t('actDone'), 'ok');
    onComplete(run.stage, { correct: run.correct, total: run.total });
    $('#act-finish').classList.remove('hidden');
    requestAnimationFrame(() => { $('#act-finish').scrollIntoView({ block: 'nearest' }); $('#act-finish').focus(); });
  }

  function open(stage) {
    const act = stage.activity;
    run = { stage, act, correct: 0, total: 0 };
    $('#activity').style.setProperty('--stage', stage.color);
    $('#act-title').textContent = L(stage.game);           // screen readers only
    $('#act-prompt-ne').textContent = act.prompt.ne;
    $('#act-prompt-tr').textContent = tr(act.prompt);
    $('#act-listen').onclick = () => sayNe(act.prompt.ne, `${stage.id}.prompt`);
    $('#act-finish').classList.add('hidden');
    feedback('');
    body().onclick = null;
    ({ match, grow, count })[act.type](act);
    openModal($('#activity'), '#act-listen');      // the instructions play only from the 🔊 button
  }
  $('#act-finish').addEventListener('click', () => { closeModal($('#activity')); onFinish(); });
  $('#act-close').addEventListener('click', () => closeModal($('#activity')));

  // ---------------------------------------------------------------- match: one sentence card, several word cards
  // The sentence has its answer word blanked out (act.read: it is shown whole, e.g. "at six o'clock" -> clock faces).
  // A wrong card drops out and the child tries again; only a right first try counts. A piece's "not" keeps off cards
  // that would fit its sentence as well.
  function match(act) {
    const sid = run.stage.id;
    const cards = act.targets.map((tg) => {
      const label = tg.item ? W(tg.item) : tg.label;
      const isClock = tg.clock != null;
      return { id: tg.item || tg.id, label, key: tg.item || `${sid}.${tg.id}`, isClock,
        art: tg.item ? art(label, tg.item) : isClock ? clockSVG(Number(tg.clock)) : emo(tg.emoji) };
    });
    const cardOf = (id) => cards.find((c) => c.id === id);
    const questions = act.ordered ? act.pieces : shuffle(act.pieces);
    run.total = questions.length;
    let i = 0, wrong = 0, solved = false;

    // [before, answer word, after]; no answer word when nothing is blanked out
    function split(p, lg) {
      const s = p.say[lg] || '';
      const word = act.read ? '' : (p.blank?.[lg] ?? cardOf(p.to).label[lg] ?? '');
      const at = word ? s.toLowerCase().indexOf(word.toLowerCase()) : -1;
      return at < 0 ? [s, '', ''] : [s.slice(0, at), s.slice(at, at + word.length), s.slice(at + word.length)];
    }
    const sentence = (p, lg) => {
      const [a, w, b] = split(p, lg);
      return `${esc(a)}${w ? `<span class="qz-blank" data-word="${esc(w)}"></span>` : ''}${esc(b)}`;
    };
    function listen(p) {
      const [a, w, b] = split(p, 'ne');
      const id = `${sid}.${p.item || p.id}`;
      if (w && !solved) sayNe(`${a} … ${b}`, `${id}.q`); else sayNe(p.say.ne, `${id}.say`);
    }
    const optionHTML = (c) => `<li><button class="qz-opt${c.isClock ? ' pic-only' : ''}" data-id="${esc(c.id)}"${c.isClock ? ` aria-label="${esc(c.label.ne)}"` : ''}>
        <span class="qz-pic" aria-hidden="true">${c.art}</span><span class="qz-word" lang="ne">${esc(c.label.ne)}</span>${tr(c.label) ? `<span class="qz-wtr">${esc(tr(c.label))}</span>` : ''}</button></li>`;
    function show() {
      const p = questions[i], answer = cardOf(p.to), lg = getLang();
      wrong = 0; solved = false;
      const others = shuffle(cards.filter((c) => c !== answer && !(p.not || []).includes(c.id))).slice(0, CHOICES - 1);
      const last = i === questions.length - 1;
      body().innerHTML = `<div class="quiz">
        <ol class="qz-dots" aria-label="${esc(`${num(i + 1)}/${num(questions.length)}`)}">${questions.map((_, k) => `<li class="${k < i ? 'on' : k === i ? 'cur' : ''}"></li>`).join('')}</ol>
        <div class="qz-card"><span class="qz-art" aria-hidden="true">${p.item ? art(W(p.item), p.item) : emo(p.emoji)}</span>
          <div class="qz-txt"><p class="qz-ne" lang="ne">${sentence(p, 'ne')}</p>${lg !== 'ne' && p.say[lg] ? `<p class="qz-tr">${sentence(p, lg)}</p>` : ''}</div>
          <button class="icon-btn qz-listen" aria-label="${esc(t('listen'))}">${icon('volume')}</button></div>
        <ul class="qz-opts">${shuffle([answer, ...others]).map(optionHTML).join('')}</ul>
        ${last ? '' : `<button class="btn btn-go btn-lg qz-next hidden"><span>${esc(t('next'))}</span>${icon('right')}</button>`}</div>`;
      feedback('');
    }
    function pick(opt, p) {
      const card = cardOf(opt.dataset.id);
      if (card.id !== p.to) {
        wrong++;
        const byKeyboard = opt.matches(':focus-visible');
        opt.disabled = true; opt.classList.add('wrong');
        if (byKeyboard) $('.qz-opt:not(:disabled)', body())?.focus();      // a disabled button loses the focus
        feedback(t('actWrong'), 'warn');
        sayNe(card.label.ne, card.key);
        return;
      }
      solved = true;
      if (!wrong) run.correct++;
      opt.classList.add('right');
      $$('.qz-opt', body()).forEach((b) => { b.disabled = true; });
      $$('.qz-blank', body()).forEach((b) => { b.textContent = b.dataset.word; b.classList.add('filled'); });
      feedback(t('actRight'), 'ok');
      sayNe(p.say.ne, `${sid}.${p.item || p.id}.say`);
      const next = $('.qz-next', body());
      if (!next) { complete(); return; }
      next.classList.remove('hidden');
      next.scrollIntoView({ block: 'nearest' });
      next.focus();
    }
    body().onclick = (e) => {
      const p = questions[i];
      if (e.target.closest('.qz-listen')) { listen(p); return; }
      if (e.target.closest('.qz-next')) { i++; show(); $('.qz-listen', body()).focus(); return; }
      const opt = e.target.closest('.qz-opt');
      if (opt && !opt.disabled) pick(opt, p);
    };
    show();
  }

  // ---------------------------------------------------------------- grow
  function grow(act) {
    const N = act.waterings || 3;
    const parts = act.parts.map((p) => ({ ...p, w: W(p.item) }));
    const seen = new Set();
    let s = 0;
    run.total = parts.length;
    body().innerHTML = `<div class="grow">
      <div class="garden"><svg class="garden-svg" viewBox="0 0 220 240" aria-hidden="true" focusable="false"></svg>
        <div class="drops" aria-hidden="true">${emojiImg('💧').repeat(3)}</div><div class="part-pins"></div></div>
      <div class="grow-side">
        <div class="row"><button class="btn btn-secondary grow-btn" id="g-seed" aria-label="${esc(t('plantSeed'))}">${emo('🌱')}</button>
          <button class="btn btn-soft grow-btn" id="g-water" aria-label="${esc(t('water'))}" disabled>${emo('💧')}</button></div>
        <p class="water-left" aria-hidden="true"></p><div class="grow-info" aria-live="polite"></div></div></div>`;
    const draw = () => { $('.garden-svg', body()).innerHTML = plantSVG(s); };
    const showWater = (used) => { $('.water-left', body()).innerHTML = Array.from({ length: N }, (_, k) => `<i class="${k < used ? 'used' : ''}">${emojiImg('💧')}</i>`).join(''); };
    draw();
    $('#g-seed').onclick = () => {
      s = 1; draw();
      $('#g-seed').disabled = true; $('#g-water').disabled = false; $('#g-water').focus();
      showWater(0);
      sayNe(SAY_NE.seed, `${run.stage.id}.seed`);
    };
    $('#g-water').onclick = () => {
      const drops = $('.drops', body());
      drops.classList.remove('rain'); void drops.offsetWidth; drops.classList.add('rain');
      s = Math.min(s + 1, N + 1); draw();
      const left = N + 1 - s;
      showWater(N - left);
      if (left > 0) { sayNe(NE_NUM[s - 1], null); return; }
      $('#g-water').disabled = true;
      $('.water-left', body()).innerHTML = '';
      sayNe(SAY_NE.grown, `${run.stage.id}.grown`);
      $('.part-pins', body()).innerHTML = parts.map((p, i) => {
        const [x, y] = PART_POS[p.item] || [50, 50];
        return `<button class="part-pin" data-item="${esc(p.item)}" aria-label="${esc(p.w.ne)}" style="left:${x}%;top:${y}%"><span class="pin-n">${toDeva(i + 1)}</span><span class="pin-w" lang="ne"></span></button>`;
      }).join('');
      $('.part-pin', body())?.focus();
    };
    $('.part-pins', body()).onclick = (e) => {
      const pin = e.target.closest('.part-pin');
      if (!pin) return;
      const p = parts.find((x) => x.item === pin.dataset.item);
      pin.classList.add('seen');
      pin.querySelector('.pin-w').textContent = p.w.ne;
      $('.grow-info', body()).innerHTML = `<p class="gi-word"><b lang="ne">${esc(p.w.ne)}</b><span lang="en">${esc(p.w.en)}</span>${getLang() === 'ko' ? `<span>${esc(p.w.ko)}</span>` : ''}</p>
        <p class="gi-say" lang="ne">${esc(p.say.ne)}</p>${tr(p.say) ? `<p class="tr-line">${esc(tr(p.say))}</p>` : ''}`;
      sayNe(`${p.w.ne}। ${p.say.ne}`, `${p.item}.say`);
      if (seen.size === parts.length) return;            // already finished: just a look back
      seen.add(p.item);
      if (seen.size === parts.length) { run.correct = parts.length; complete(); }
    };
  }

  // ---------------------------------------------------------------- count
  function count(act) {
    const list = act.list.map((r) => ({ ...r, w: W(r.item), tries: 0 }));
    const sum = list.reduce((a, r) => a + r.n, 0);
    let i = 0, got = 0;
    run.total = list.length + 1;
    body().innerHTML = `<div class="count">
      <div class="shop"><span class="shop-icon" aria-hidden="true">${emojiImg('📝')}</span><ol class="shop-list">${list.map((r, k) => `<li data-k="${k}">${emo(r.w.emoji)}
        <b>${toDeva(r.n)}</b><span lang="ne">${esc(r.w.ne)}</span><span class="tick" aria-hidden="true">✓</span></li>`).join('')}</ol></div>
      <div class="stall" role="group"></div>
      <div class="basket"><span class="basket-icon" aria-hidden="true">${emojiImg('🧺')}</span><div class="basket-items"></div>
        <p class="counter"><b id="c-num">०</b><small id="c-word" lang="ne"></small></p></div>
      <div class="row"><button class="btn btn-secondary" id="c-done">✔ ${esc(t('countDone'))}</button></div>
      <div class="total-q hidden"></div></div>`;
    const stall = $('.stall', body()), basket = $('.basket-items', body());
    const showCount = () => { $('#c-num').textContent = toDeva(got); $('#c-word').textContent = got ? NE_NUM[got] : ''; };
    const item = (r, where) => `<button class="${where}" data-item="${esc(r.item)}" aria-label="${esc(r.w.ne)}">${emo(r.w.emoji)}</button>`;
    let busy = false;                      // between a correct basket and the next list item: ignore taps
    function setup() {
      const r = list[i];
      got = 0; showCount();
      busy = false; $('#c-done').disabled = false;
      $$('.shop-list li', body()).forEach((li) => li.classList.toggle('cur', Number(li.dataset.k) === i));
      stall.innerHTML = Array.from({ length: r.n + EXTRA_IN_STALL }, () => item(r, 'st-item')).join('');
      sayNe(`${NE_NUM[r.n]} वटा ${r.w.ne}`, `${run.stage.id}.list${i}`);
    }
    stall.onclick = (e) => {
      const b = e.target.closest('.st-item');
      if (!b || busy) return;
      b.remove();
      basket.insertAdjacentHTML('beforeend', item(list[i], 'bk-item cur'));
      got++; showCount();
      sayNe(NE_NUM[got] || toDeva(got), null);
    };
    basket.onclick = (e) => {
      const b = e.target.closest('.bk-item.cur');
      if (!b || busy) return;
      b.remove();
      stall.insertAdjacentHTML('beforeend', item(list[i], 'st-item'));
      got--; showCount();
    };
    $('#c-done').onclick = () => {
      if (busy) return;
      const r = list[i];
      if (got !== r.n) {
        r.tries++;
        feedback(t('needN', num(r.n)), 'warn');
        sayNe(`${NE_NUM[r.n]} वटा चाहिन्छ।`, null);
        return;
      }
      if (!r.tries) run.correct++;
      busy = true; $('#c-done').disabled = true;
      feedback(`${t('actRight')} ${toDeva(r.n)} ${r.w.ne}`, 'ok');
      $$('.bk-item.cur', basket).forEach((b) => { b.classList.remove('cur'); b.disabled = true; });
      body().querySelector(`.shop-list li[data-k="${i}"]`).classList.add('done');
      i++;
      if (i < list.length) { setTimeout(setup, 700); return; }
      totalQuestion();
    };
    function totalQuestion() {
      stall.innerHTML = '';
      stall.classList.add('hidden');
      $('#c-done').classList.add('hidden');
      $$('.shop-list li', body()).forEach((li) => li.classList.remove('cur'));
      const q = $('.total-q', body());
      let wrong = 0;
      q.classList.remove('hidden');
      q.innerHTML = `<p class="tq" lang="ne">${esc(I18N.ne.totalQ)}</p>${t('totalQ') !== I18N.ne.totalQ ? `<p class="tr-line">${esc(t('totalQ'))}</p>` : ''}
        <div class="row">${act.total.options.map((n) => `<button class="btn btn-soft tq-opt" data-n="${n}"><b>${toDeva(n)}</b><small lang="ne">${NE_NUM[n]}</small></button>`).join('')}</div>`;
      sayNe(I18N.ne.totalQ, `${run.stage.id}.total`);
      q.onclick = (e) => {
        const b = e.target.closest('.tq-opt');
        if (!b || b.disabled) return;
        if (Number(b.dataset.n) !== sum) { wrong++; b.disabled = true; b.classList.add('wrong'); feedback(t('actWrong'), 'warn'); return; }
        b.classList.add('right');
        $$('.tq-opt', q).forEach((x) => { x.disabled = true; });
        if (!wrong) run.correct++;
        sayNe(`जम्मा ${NE_NUM[sum]} वटा।`, null);
        complete();
      };
    }
    setup();
  }

  return { open };
}
