// Stage games: the "Proposed Game / Software Feature" column of the Grade 2 Game ideas. A stage's game
// opens once every hotspot of that stage has been found.
//   match : put cards on their places (who does what / tool -> body part / routine -> clock / animal -> home)
//   grow  : plant a seed, water it, then touch the plant parts (root, stem, leaf, flower)
//   count : fill the basket from a shopping list, counting in Nepali, then "how many in all?"
// Cards can be tapped (card, then place) or dragged. Everything is a <button>, so Tab + Enter works too.
import { t, L, getLang, toDeva, NE_NUM, I18N } from './i18n.js';
import { $, $$, esc, shuffle, openModal, closeModal } from './ui.js';

const DRAG_START_PX = 8;
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
 * @param {{ tour: object, speak: (o: {text: string, lang: string, key?: string}) => unknown,
 *           onFinish: (stage: object, result: {correct: number, total: number}) => void }} ctx
 */
export function createActivities({ tour, speak, onFinish }) {
  const W = (id) => tour.words[id];
  const body = () => $('#act-body');
  let run = null;                       // { stage, act, correct, total }
  const sayNe = (text, key) => speak({ text, lang: 'ne', key });
  const num = (n) => (getLang() === 'ne' ? toDeva(n) : String(n));
  const tr = (obj) => { const s = L(obj); return s === obj?.ne ? '' : s; };     // translation line, empty in the Nepali UI
  const emo = (e) => `<span class="emo">${esc(e)}</span>`;
  const art = (w, id) => (w.pic ? `<img src="${esc(w.pic)}" alt="">` : w.emoji ? emo(w.emoji) : `<img src="assets/cards/${esc(id)}.jpg" alt="">`);
  function feedback(msg, kind = '') { const f = $('#act-feedback'); f.textContent = msg; f.className = `qz-feedback ${kind}`; }
  function complete() {
    feedback(t('actDone'), 'ok');
    $('#act-finish').classList.remove('hidden');
    requestAnimationFrame(() => $('#act-finish').focus());
  }

  function open(stage) {
    const act = stage.activity;
    run = { stage, act, correct: 0, total: 0 };
    $('#activity').style.setProperty('--stage', stage.color);
    $('#act-tag').textContent = t('stageN', num(stage.n));
    $('#act-title').textContent = L(stage.game);
    $('#act-prompt-ne').textContent = act.prompt.ne;
    $('#act-prompt-tr').textContent = tr(act.prompt);
    $('#act-listen').onclick = () => sayNe(act.prompt.ne, `${stage.id}.prompt`);
    $('#act-finish').classList.add('hidden');
    feedback('');
    body().onclick = null; body().onpointerdown = null;
    ({ match, grow, count })[act.type](act);
    openModal($('#activity'), '#act-listen');
    sayNe(act.prompt.ne, `${stage.id}.prompt`);
  }
  $('#act-finish').addEventListener('click', () => {
    closeModal($('#activity'));
    onFinish(run.stage, { correct: run.correct, total: run.total });
  });
  $('#act-close').addEventListener('click', () => closeModal($('#activity')));

  // ---------------------------------------------------------------- match
  let drag = null;
  let suppressClick = false;
  function match(act) {
    const sid = run.stage.id;
    const targets = act.targets.map((tg) => {
      if (tg.item) { const w = W(tg.item); return { id: tg.item, ne: w.ne, thr: w.thr, tr: tr(w), art: art(w, tg.item), key: tg.item }; }
      return { id: tg.id, ne: tg.label.ne, tr: tr(tg.label), key: `${sid}.${tg.id}`,
        art: tg.clock != null ? clockSVG(Number(tg.clock)) : emo(tg.emoji) };
    });
    const pieces = act.pieces.map((pc) => {
      if (pc.item) { const w = W(pc.item); return { ...pc, pid: pc.item, ne: w.ne, tr: tr(w), art: art(w, pc.item), key: pc.item }; }
      return { ...pc, pid: pc.id, ne: pc.text.ne, tr: tr(pc.text), art: emo(pc.emoji), key: `${sid}.${pc.id}` };
    });
    run.total = pieces.length;
    const tries = {};
    let sel = null;
    const line = (o) => `<span class="mt-txt"><span class="mt-ne" lang="ne">${esc(o.ne)}</span>${o.thr ? `<span class="mt-thr" lang="thr">${esc(o.thr)}</span>` : ''}${o.tr ? `<span class="mt-tr">${esc(o.tr)}</span>` : ''}</span>`;
    body().innerHTML = `<p class="act-howto">${esc(t('tapOrDrag'))}</p>
      <ul class="mt-pieces">${shuffle(pieces).map((p) => `<li><button class="mt-piece" data-pid="${esc(p.pid)}" aria-pressed="false">${p.art}${line(p)}</button></li>`).join('')}</ul>
      <ul class="mt-targets${act.ordered ? ' ordered' : ''}">${(act.ordered ? targets : shuffle(targets)).map((tg) => `<li class="mt-target" data-tid="${esc(tg.id)}">
        <button class="mt-t-btn" data-tid="${esc(tg.id)}">${tg.art}${line(tg)}</button><div class="mt-slot"></div></li>`).join('')}</ul>`;
    const pieceEl = (pid) => body().querySelector(`.mt-piece[data-pid="${CSS.escape(pid)}"]`);
    const select = (pid) => {
      sel = pid;
      $$('.mt-piece', body()).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pid === pid)));
      body().classList.toggle('picking', !!pid);
    };
    function attempt(pid, tid) {
      const p = pieces.find((x) => x.pid === pid), tg = targets.find((x) => x.id === tid);
      const box = body().querySelector(`.mt-target[data-tid="${CSS.escape(tid)}"]`);
      if (!p || !tg || !box) return;
      tries[pid] = (tries[pid] || 0) + 1;
      if (p.to !== tid) {
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        feedback(t('actWrong'), 'warn');
        sayNe(tg.ne, tg.key);
        return;
      }
      if (tries[pid] === 1) run.correct++;
      const el = pieceEl(pid), li = el.parentElement;
      el.disabled = true; el.classList.add('placed'); el.setAttribute('aria-pressed', 'false');
      box.querySelector('.mt-slot').appendChild(el);
      li.remove();
      box.classList.add('filled');
      select(null);
      feedback(`${t('actRight')} ${p.say ? L(p.say) : ''}`, 'ok');
      sayNe(p.say?.ne || `${p.ne}, ${tg.ne}`, `${sid}.${pid}.say`);
      if (pieces.every((x) => pieceEl(x.pid)?.disabled)) complete();
    }
    body().onclick = (e) => {
      if (suppressClick) { suppressClick = false; return; }
      const pb = e.target.closest('.mt-piece');
      if (pb) {
        if (pb.disabled) return;
        const pid = pb.dataset.pid, p = pieces.find((x) => x.pid === pid);
        select(pid);                       // stays picked after a wrong try, so the child can try another place
        sayNe(p.ne, p.key);
        return;
      }
      const tb = e.target.closest('.mt-t-btn');
      if (!tb) return;
      if (sel) attempt(sel, tb.dataset.tid);
      else { const tg = targets.find((x) => x.id === tb.dataset.tid); sayNe(tg.ne, tg.key); }
    };
    body().onpointerdown = (e) => {
      const pb = e.target.closest('.mt-piece');
      if (!pb || pb.disabled || e.button > 0) return;
      drag = { pb, pid: pb.dataset.pid, x0: e.clientX, y0: e.clientY, ghost: null, over: null, attempt };
    };
  }
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_START_PX) return;
      drag.ghost = drag.pb.cloneNode(true);
      drag.ghost.classList.add('mt-ghost');
      document.body.appendChild(drag.ghost);
      drag.pb.classList.add('dragging');
    }
    drag.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.mt-target') || null;
    if (over !== drag.over) { drag.over?.classList.remove('over'); over?.classList.add('over'); drag.over = over; }
  });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.ghost) return;                             // no movement: the click handler treats it as a tap
    d.ghost.remove();
    d.pb.classList.remove('dragging');
    d.over?.classList.remove('over');
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (e.type === 'pointerup' && d.over) d.attempt(d.pid, d.over.dataset.tid);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  // ---------------------------------------------------------------- grow
  function grow(act) {
    const N = act.waterings || 3;
    const parts = act.parts.map((p) => ({ ...p, w: W(p.item) }));
    const seen = new Set();
    let s = 0;
    run.total = parts.length;
    body().innerHTML = `<div class="grow">
      <div class="garden"><svg class="garden-svg" viewBox="0 0 220 240" aria-hidden="true" focusable="false"></svg>
        <div class="drops" aria-hidden="true"></div><div class="part-pins"></div></div>
      <div class="grow-side">
        <div class="row"><button class="btn btn-secondary" id="g-seed"><span class="emo">🌱</span><span>${esc(t('plantSeed'))}</span></button>
          <button class="btn btn-soft" id="g-water" disabled><span class="emo">💧</span><span>${esc(t('water'))}</span></button></div>
        <p class="grow-status" aria-live="polite"></p><div class="grow-info" aria-live="polite"></div></div></div>`;
    const draw = () => { $('.garden-svg', body()).innerHTML = plantSVG(s); };
    const status = (msg) => { $('.grow-status', body()).textContent = msg; };
    draw();
    $('#g-seed').onclick = () => {
      s = 1; draw();
      $('#g-seed').disabled = true; $('#g-water').disabled = false; $('#g-water').focus();
      status(t('waterLeft', N));
      sayNe(SAY_NE.seed, `${run.stage.id}.seed`);
    };
    $('#g-water').onclick = () => {
      const drops = $('.drops', body());
      drops.classList.remove('rain'); void drops.offsetWidth; drops.classList.add('rain');
      s = Math.min(s + 1, N + 1); draw();
      const left = N + 1 - s;
      if (left > 0) { status(t('waterLeft', left)); sayNe(NE_NUM[s - 1], null); return; }
      $('#g-water').disabled = true;
      status(t('tapParts'));
      sayNe(SAY_NE.grown, `${run.stage.id}.grown`);
      $('.part-pins', body()).innerHTML = parts.map((p, i) => {
        const [x, y] = PART_POS[p.item] || [50, 50];
        return `<button class="part-pin" data-item="${esc(p.item)}" style="left:${x}%;top:${y}%"><span class="pin-n">${toDeva(i + 1)}</span><span class="pin-w" lang="ne"></span></button>`;
      }).join('');
      $('.part-pin', body())?.focus();
    };
    $('.part-pins', body()).onclick = (e) => {
      const pin = e.target.closest('.part-pin');
      if (!pin) return;
      const p = parts.find((x) => x.item === pin.dataset.item);
      pin.classList.add('seen');
      pin.querySelector('.pin-w').textContent = p.w.ne;
      $('.grow-info', body()).innerHTML = `<p class="gi-word"><b lang="ne">${esc(p.w.ne)}</b><span lang="thr">${esc(t('thrLabel'))}: ${esc(p.w.thr)}</span>
        <span>${esc(t('enLabel'))}: ${esc(p.w.en)}</span>${tr(p.w) ? `<span>${esc(tr(p.w))}</span>` : ''}</p>
        <p class="gi-say" lang="ne">${esc(p.say.ne)}</p>${tr(p.say) ? `<p class="muted">${esc(tr(p.say))}</p>` : ''}`;
      sayNe(`${p.w.ne}। ${p.say.ne}`, `${p.item}.say`);
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
      <div class="shop"><h4>${esc(t('listTitle'))}</h4><ol class="shop-list">${list.map((r, k) => `<li data-k="${k}">${emo(r.w.emoji)}
        <b>${toDeva(r.n)}</b><span lang="ne">${esc(r.w.ne)}</span><span class="tick" aria-hidden="true">✓</span></li>`).join('')}</ol></div>
      <div class="stall" role="group"></div>
      <div class="basket"><h4>${esc(t('basket'))}</h4><div class="basket-items"></div>
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
        feedback(t('needN', num(r.n), num(got)), 'warn');
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
      q.innerHTML = `<p class="tq" lang="ne">${esc(I18N.ne.totalQ)}</p>${t('totalQ') !== I18N.ne.totalQ ? `<p class="muted">${esc(t('totalQ'))}</p>` : ''}
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
