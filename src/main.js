// Virtual Village (Grade 2, Tharu -> Nepali) — hybrid 360° photo + 3DGS village (PlayCanvas engine)
//
// Six stages (tour.json -> stages), each a short stretch of the capture path. Inside a stage you can only
// walk between that stage's spots; its hotspots are real objects in the photo (pins) or 2D pictures
// standing in the 360 scene (stickers, sized by distance so they keep their place when you walk in 3D).
//
// One space, two kinds of spot (tour.json -> nodes[*].media). Every spot used by a stage is "3dgs".
//   "360"  : the spot is its 360 photo only (drawn as a background "skybox"); nothing 3D is loaded.
//   "3dgs" : its near-field 3DGS splat is drawn on top of the same spot's 360 photo, so one frame
//            mixes both: splats up close (real parallax when you walk), the photo for sky and far
//            scenery. Walking is enabled only here. The viewer switches automatically from the spot
//            type — there is no 360/3DGS toggle.
// For proxy splats (built from a single photo, softer than the photo) and trained splats flagged
// photoAtRest (artifacts on the capture point) the crisp photo is shown while you stand on the capture
// point and the splat fades in as soon as you step away. Other trained splats stay on all the time.
//
// Conventions (shared with tools/*.py):
//   equirect u,v -> lon=(u-.5)*2PI, lat=(.5-v)*PI; local dir = (cos lat sin lon, sin lat, -cos lat cos lon)
//   world = Ry(yaw) * local + position      (PlayCanvas setEulerAngles(0, yaw, 0))
import * as pc from 'playcanvas';
import { t, L, getLang, setLangValue, toDeva, UI_LANGS } from './i18n.js';
import { icon } from './icons.js';
import { $, esc, openModal, closeModal, topModal } from './ui.js';
import { emojiImg } from './emoji.js';
import { setAudioIndex, stopVoice } from './audio.js';
import { createLearning } from './learn.js';
import { createAlign } from './align.js';

const DEG = Math.PI / 180;
const STICKER_MIN_PX = 46;           // stickers stay tappable when far away
const STICKER_MAX_VH = 0.42;         // ... and never fill the screen when close
const MAP_MIN_SPAN = 26;             // metres shown by the minimap around a stage
const params = new URLSearchParams(location.search);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---------------------------------------------------------------- math
const localDir = (u, v) => {
  const lon = (u - 0.5) * 2 * Math.PI, lat = (0.5 - v) * Math.PI;
  return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon)];
};
const rotY = (d, yawDeg) => {
  const c = Math.cos(yawDeg * DEG), s = Math.sin(yawDeg * DEG);
  return [d[0] * c + d[2] * s, d[1], -d[0] * s + d[2] * c];
};
const camYawFor = (d) => Math.atan2(-d[0], -d[2]) / DEG;   // camera yaw (deg) that looks along world dir d
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (e0, e1, x) => { const k = clamp((x - e0) / (e1 - e0), 0, 1); return k * k * (3 - 2 * k); };
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const angDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;

// ---------------------------------------------------------------- app
const canvas = $('#app');
const app = new pc.Application(canvas, {
  mouse: undefined, touch: undefined, keyboard: undefined,
  graphicsDeviceOptions: { antialias: false, alpha: false, deviceTypes: [pc.DEVICETYPE_WEBGL2] },
});
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);
app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
window.addEventListener('resize', () => app.resizeCanvas());
app.start();
const device = app.graphicsDevice;

const camera = new pc.Entity('camera');
camera.addComponent('camera', {
  clearColor: new pc.Color(0.93, 0.96, 1), fov: 75, nearClip: 0.05, farClip: 1000,
  gammaCorrection: pc.GAMMA_SRGB, toneMapping: pc.TONEMAP_NONE,   // splat colours pass through untouched (same as the 360 shader)
});
app.root.addChild(camera);
const view = { yaw: 0, pitch: 0, fov: 75 };
const applyView = () => { camera.setLocalEulerAngles(view.pitch, view.yaw, 0); camera.camera.fov = view.fov; };

// ---------------------------------------------------------------- 360° background (two equirects + blend)
const PANO_VS = /* glsl */`
attribute vec3 vertex_position;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec3 vDir;
void main(void) {
  vDir = vertex_position;
  gl_Position = matrix_viewProjection * matrix_model * vec4(vertex_position, 1.0);
}`;
const PANO_FS = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uYawA;
uniform float uYawB;
uniform float uMix;
uniform vec3 uTravel;
uniform float uZoomA;
uniform float uZoomB;
// magnify around the walking direction t (s > 1 = step forward); 2*atan(tan(th/2)/s) keeps the whole sphere continuous
vec3 zoomDir(vec3 d, vec3 t, float s) {
  if (abs(s - 1.0) < 1e-4) return d;
  float c = clamp(dot(d, t), -1.0, 1.0);
  vec3 p = d - c * t;
  float lp = length(p);
  if (lp < 1e-5) return d;
  float th = 2.0 * atan(tan(acos(c) * 0.5) / s);
  return cos(th) * t + sin(th) * (p / lp);
}
vec2 equirectUV(vec3 d, float yaw) {
  float c = cos(yaw), s = sin(yaw);
  vec3 l = vec3(c * d.x - s * d.z, d.y, s * d.x + c * d.z);
  float lon = atan(l.x, -l.z);
  float lat = asin(clamp(l.y, -1.0, 1.0));
  return vec2(lon / 6.28318531 + 0.5, 0.5 - lat / 3.14159265);
}
void main(void) {
  vec3 d = normalize(vDir);
  vec3 a = textureLod(uTexA, equirectUV(zoomDir(d, uTravel, uZoomA), uYawA), 0.0).rgb;
  vec3 b = textureLod(uTexB, equirectUV(zoomDir(d, uTravel, uZoomB), uYawB), 0.0).rgb;
  gl_FragColor = vec4(mix(a, b, uMix), 1.0);
}`;
const panoMat = new pc.ShaderMaterial({
  uniqueName: 'cevPanoBlend', vertexGLSL: PANO_VS, fragmentGLSL: PANO_FS,
  attributes: { vertex_position: pc.SEMANTIC_POSITION },
});
panoMat.cull = pc.CULLFACE_NONE;
panoMat.depthWrite = false;
panoMat.depthTest = false;
const blankTex = new pc.Texture(device, { width: 1, height: 1, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
blankTex.lock().set([226, 236, 250, 255]); blankTex.unlock();
const pano = { a: blankTex, b: blankTex, yawA: 0, yawB: 0, mix: 0, travel: [0, 0, -1], zoomA: 1, zoomB: 1 };
const syncPano = () => {
  panoMat.setParameter('uTexA', pano.a); panoMat.setParameter('uTexB', pano.b);
  panoMat.setParameter('uYawA', pano.yawA * DEG); panoMat.setParameter('uYawB', pano.yawB * DEG);
  panoMat.setParameter('uMix', pano.mix);
  panoMat.setParameter('uTravel', pano.travel);
  panoMat.setParameter('uZoomA', pano.zoomA); panoMat.setParameter('uZoomB', pano.zoomB);
};
syncPano();
const panoBox = new pc.Entity('pano');
panoBox.addComponent('render', { type: 'box', material: panoMat, layers: [pc.LAYERID_SKYBOX], castShadows: false, receiveShadows: false });
panoBox.setLocalScale(20, 20, 20);
app.root.addChild(panoBox);

// texture cache (small LRU: 4096x2048 RGBA = 32 MB GPU each)
const texCache = new Map();
const loadImage = (url) => new Promise((res, rej) => {
  const img = new Image(); img.crossOrigin = 'anonymous';
  img.onload = () => res(img); img.onerror = () => rej(new Error('image ' + url)); img.src = url;
});
const makeTex = (img) => {
  const tex = new pc.Texture(device, {
    width: img.width, height: img.height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false,
    minFilter: pc.FILTER_LINEAR, magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
  });
  tex.setSource(img);
  return tex;
};
function panoTexture(node, onUpgrade) {
  let e = texCache.get(node.id);
  if (!e) {
    e = { thumb: null, full: null };
    e.thumbP = loadImage(node.thumb).then((img) => (e.thumb = makeTex(img)));
    e.fullP = loadImage(node.pano).then((img) => (e.full = makeTex(img)));
    texCache.set(node.id, e);
    while (texCache.size > 5) {
      const [k, old] = texCache.entries().next().value;
      if (k === state.node?.id) break;
      if (old.full && old.full !== pano.a && old.full !== pano.b) old.full.destroy();
      texCache.delete(k);
    }
  } else { texCache.delete(node.id); texCache.set(node.id, e); }
  if (onUpgrade) e.fullP.then((tx) => onUpgrade(tx)).catch(() => {});
  return e;
}
async function bestTexture(node, waitFullMs = 900) {
  const e = panoTexture(node);
  if (e.full) return e.full;
  const full = await Promise.race([e.fullP, new Promise((r) => setTimeout(r, waitFullMs))]).catch(() => null);
  if (full) return full;
  await e.thumbP.catch(() => null);
  return e.full || e.thumb || blankTex;
}

// ---------------------------------------------------------------- 3DGS splats (key spots only)
// uFade: whole-splat fade.  uCropR > 0: fade out splats farther than uCropR metres (horizontally) from
// uCropCenter, so a trained splat of a whole area only fills the near field and the 360 photo shows beyond.
// (Work-buffer modifiers receive world-space centres.)
const FADE_MOD = {
  glsl: `
uniform float uFade;
uniform vec3 uCropCenter;
uniform float uCropR;
void modifySplatCenter(inout vec3 center) {}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
void modifySplatColor(vec3 center, inout vec4 color) {
  float k = 1.0;
  if (uCropR > 0.0) k = 1.0 - smoothstep(uCropR * 0.8, uCropR, length(center.xz - uCropCenter.xz));
  color.a *= uFade * k;
}
`,
  wgsl: `
uniform uFade: f32;
uniform uCropCenter: vec3f;
uniform uCropR: f32;
fn modifySplatCenter(center: ptr<function, vec3f>) {}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var k = 1.0;
  if (uniform.uCropR > 0.0) { k = 1.0 - smoothstep(uniform.uCropR * 0.8, uniform.uCropR, length(center.xz - uniform.uCropCenter.xz)); }
  (*color).a = (*color).a * uniform.uFade * k;
}
`,
};
// splatTransform {position, yaw, scale, flip}: flip turns a Y-down (raw COLMAP) splat upright
function applySplatTransform(e, node, tr = node.splatTransform || {}) {
  const p = tr.position || node.position;
  e.setPosition(p[0], p[1], p[2]);
  const q = new pc.Quat().setFromEulerAngles(0, tr.yaw ?? node.yaw, 0);
  if (tr.flip) q.mul(new pc.Quat().setFromEulerAngles(0, 0, 180));
  e.setRotation(q);
  const sc = tr.scale || 1;
  e.setLocalScale(sc, sc, sc);
}
const WB_ALWAYS = pc.WORKBUFFER_UPDATE_ALWAYS ?? 2;
const WB_AUTO = pc.WORKBUFFER_UPDATE_AUTO ?? 0;
const splats = new Map();      // id -> { entity, promise, fade, settled }
const isKey = (n) => n?.media === '3dgs' && !!n.splat;
const photoAtRest = (n) => (n.splatKind || '').startsWith('proxy') || !!n.photoAtRest;   // photoAtRest: trained splat with artifacts on the capture point
function ensureSplat(node) {
  let s = splats.get(node.id);
  if (s) return s.promise;
  s = { entity: null, fade: 0, settled: true };
  s.promise = new Promise((resolve, reject) => {
    const asset = new pc.Asset('splat-' + node.id, 'gsplat', { url: node.splat });
    asset.once('load', () => {
      const e = new pc.Entity('splat-' + node.id);
      e.addComponent('gsplat', { asset });
      applySplatTransform(e, node);
      e.gsplat.setWorkBufferModifier(FADE_MOD);
      e.gsplat.setParameter('uFade', 0);
      e.gsplat.setParameter('uCropCenter', node.position);
      e.gsplat.setParameter('uCropR', node.splatCrop || 0);
      e.enabled = false;
      app.root.addChild(e);
      s.entity = e;
      resolve(s);
    });
    asset.once('error', (err) => { splats.delete(node.id); reject(err); });
    app.assets.add(asset);
    app.assets.load(asset);
  });
  splats.set(node.id, s);
  return s.promise;
}
function setSplatFade(s, f) {
  if (!s?.entity || Math.abs(s.fade - f) < 1e-4) return;
  s.fade = f;
  const on = f > 0.003;
  if (s.entity.enabled !== on) s.entity.enabled = on;
  s.entity.gsplat.setParameter('uFade', f);
  s.entity.gsplat.workBufferUpdate = WB_ALWAYS;
  s.settled = false;
}
function settleSplats() {
  for (const s of splats.values()) if (s.entity && !s.settled) { s.entity.gsplat.workBufferUpdate = WB_AUTO; s.settled = true; }
}
function pruneSplats(keepIds) {
  for (const [id, s] of splats) {
    if (keepIds.has(id) || !s.entity) continue;
    const asset = s.entity.gsplat.asset;
    s.entity.destroy();
    const a = typeof asset === 'number' ? app.assets.get(asset) : asset;
    if (a) { a.unload(); app.assets.remove(a); }
    splats.delete(id);
  }
}

// ---------------------------------------------------------------- tour state
const state = { tour: null, node: null, stage: null, screen: 'landing', busy: false, offset: [0, 0, 0] };
const nodeById = (id) => state.tour.nodes.find((n) => n.id === id);
// the walkable path: the current stage's spots in capture order (all spots outside a stage, e.g. align mode)
const pathIds = () => (state.stage ? state.stage.nodes : state.tour.nodes.map((n) => n.id));
const inPath = (id) => pathIds().includes(id);
const num = (n) => (getLang() === 'ne' ? toDeva(n) : String(n));
function setCamPos(p) { camera.setPosition(p[0], p[1], p[2]); panoBox.setPosition(p[0], p[1], p[2]); }
let learning = null;

// ---------------------------------------------------------------- UI: text + chrome
function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show ${kind}`;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { el.className = 'toast'; }, 2800);
}
function status(msg) { $('#status-text').textContent = msg || ''; $('#status').classList.toggle('hidden', !msg); }

function renderLangMenus() {
  const cur = getLang();
  const items = UI_LANGS.map((l) => `<button class="chip${l.id === cur ? ' on' : ''}" data-lang="${l.id}" lang="${l.id}" aria-pressed="${l.id === cur}">${esc(l.label)}</button>`).join('');
  $('#lang-chips').innerHTML = items;
  $('#lang-menu').innerHTML = items;
  $('#btn-lang').textContent = UI_LANGS.find((l) => l.id === cur)?.short || cur;
  $('#btn-lang').setAttribute('aria-label', t('langLabel'));
}
function applyI18n() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-walk]').forEach((el) => el.setAttribute('aria-label', t('walk', el.dataset.move)));
  const title = state.tour.title;
  $('#landing-title').textContent = title.ne;
  $('#landing-title-sub').textContent = getLang() !== 'ne' ? L(title) : '';
  document.title = `${title.ne} · ${title.en}`;
  renderLangMenus();
  learning.renderLanding();
  if (state.node) { updateWhere(); buildMinimap(); buildHotspots(); learning.render(); }
}
// moving between spots: the rings on the ground (and the minimap); no separate prev/next buttons
function updateWhere() {
  $('#walk-pad').classList.toggle('hidden', !isKey(state.node) || state.busy);
}

// ---------------------------------------------------------------- hotspots (HTML overlay anchored in 3D)
const hsLayer = $('#hotspots');
let hotspots = [];
function clearHotspots() { hsLayer.innerHTML = ''; hotspots = []; }
// A stage spot in world space. Stickers standing on the ground ("ground": metres) are anchored at their feet;
// everything else sits on the ray through (u, v) at "dist" metres.
function spotWorld(n, sp) {
  if (sp.ground != null) {
    const d = rotY(localDir(sp.u, 0.5), n.yaw);
    return { at: [n.position[0] + d[0] * sp.ground, n.position[1] - n.camHeight, n.position[2] + d[2] * sp.ground], ground: true };
  }
  const d = rotY(localDir(sp.u, sp.v), n.yaw), dist = sp.dist || 8;
  return { at: [n.position[0] + d[0] * dist, n.position[1] + d[1] * dist, n.position[2] + d[2] * dist], ground: false };
}
function buildHotspots() {
  clearHotspots();
  if (!state.node || state.screen !== 'tour' || state.busy) return;
  const n = state.node, ids = pathIds();
  for (const id of n.links.filter(inPath)) {
    const m = nodeById(id);
    const el = document.createElement('button');
    el.className = 'hs hs-nav';
    el.setAttribute('aria-label', `${ids.indexOf(id) < ids.indexOf(n.id) ? t('prevSpot') : t('nextSpot')}: ${num(ids.indexOf(id) + 1)}`);
    el.innerHTML = `<span class="ring">${icon('up')}</span>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); goTo(id); });
    const d = [m.position[0] - n.position[0], 0, m.position[2] - n.position[2]];
    const len = Math.hypot(d[0], d[2]);
    const k = Math.min(1, 4.5 / len);
    const w = [n.position[0] + d[0] * k, n.position[1] - n.camHeight + 0.05, n.position[2] + d[2] * k];
    hsLayer.appendChild(el);
    hotspots.push({ el, world: new pc.Vec3(...w) });
  }
  const hinted = learning.hintItem();
  for (const sp of (state.stage?.spots || []).filter((s) => s.node === n.id)) {
    const st = learning.itemState(sp.item);
    if (st === 'hidden') continue;
    const w = state.tour.words[sp.item];
    const { at, ground } = spotWorld(n, sp);
    const el = document.createElement('button');
    el.setAttribute('aria-label', st === 'found' ? `${w.ne} (${w.thr})` : t('unknownSpot'));
    el.addEventListener('click', (e) => { e.stopPropagation(); learning.tapItem(sp.item); });
    const isSticker = !!(w.emoji || w.pic);
    if (isSticker) {
      // people stand as full-body figures (assets/people, tools/make_people.py); a person with only a face emoji
      // falls back to a role card on a post
      const pic = w.pic ? `<img src="${esc(w.pic)}" alt="">` : emojiImg(w.emoji);
      const art = w.figure ? `<img class="stk-figure" src="${esc(w.figure)}" alt="">`
        : w.person ? `<span class="stk-card">${w.pic ? pic : `<span class="stk-face">${pic}</span>`}</span><span class="stk-post"></span>` : pic;
      el.className = `hs hs-stk ${st}${ground ? ' on-ground' : ''}${w.person ? ' person' : ''}${w.figure ? ' figure' : ''}${hinted === sp.item ? ' is-hint' : ''}`;
      el.style.setProperty('--stage', state.stage.color);   // setProperty: no HTML parsing involved
      // still to be found: a copy under the picture carries the glow, so only its opacity has to be animated
      const glow = st === 'active' ? `<span class="stk-art stk-glow" aria-hidden="true">${art}</span>` : '';
      el.innerHTML = `${ground ? '<span class="stk-shadow" aria-hidden="true"></span>' : ''}${glow}<span class="stk-art" aria-hidden="true">${art}</span>${st === 'found' ? `<span class="stk-badge" aria-hidden="true">${icon('check')}</span>` : ''}`;
      const size = w.size || 1;
      const top = ground ? [at[0], at[1] + size, at[2]] : [at[0], at[1] + size / 2, at[2]];
      hsLayer.appendChild(el);
      hotspots.push({ el, world: new pc.Vec3(...at), top: new pc.Vec3(...top), ground, fs: 0 });
    } else {
      el.className = `hs hs-obj ${st}${hinted === sp.item ? ' is-hint' : ''}`;
      el.innerHTML = `<span class="pin">${icon(st === 'found' ? 'check' : 'search')}</span>`;
      hsLayer.appendChild(el);
      hotspots.push({ el, world: new pc.Vec3(...at) });
    }
  }
}
const _scr = new pc.Vec3();
const _scrTop = new pc.Vec3();
const _fwd = new pc.Vec3();
function updateHotspots() {
  if (!hotspots.length) return;
  const fwd = camera.forward, cp = camera.getPosition();
  for (const h of hotspots) {
    _fwd.sub2(h.world, cp);
    if (_fwd.dot(fwd) <= 0.05) { h.el.style.display = 'none'; continue; }
    camera.camera.worldToScreen(h.world, _scr);
    h.el.style.display = '';
    if (!h.top) { h.el.style.transform = `translate(${_scr.x}px, ${_scr.y}px) translate(-50%, -50%)`; continue; }
    // sticker: font-size = projected height of its world size, so it keeps its place and scale as you move
    camera.camera.worldToScreen(h.top, _scrTop);
    const px = Math.abs(_scr.y - _scrTop.y) * (h.ground ? 1 : 2);
    const fs = clamp(px, STICKER_MIN_PX, window.innerHeight * STICKER_MAX_VH);
    if (Math.abs(fs - h.fs) > 0.5) { h.el.style.fontSize = `${fs.toFixed(1)}px`; h.fs = fs; }
    h.el.style.transform = `translate(${_scr.x}px, ${_scr.y}px) translate(-50%, ${h.ground ? '-100%' : '-50%'})`;
  }
}

// ---------------------------------------------------------------- minimap
let mapProj = null;
function buildMinimap() {
  const svg = $('#map-svg');
  const nodes = state.tour.nodes, ids = pathIds();
  const focus = ids.map(nodeById);                       // frame the current stage; the rest of the path fades out
  const xs = focus.map((n) => n.position[0]), zs = focus.map((n) => n.position[2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const span = Math.max(maxX - minX, maxZ - minZ, MAP_MIN_SPAN);
  const s = 140 / span, cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  mapProj = (p) => [100 + (p[0] - cx) * s, 100 + (p[2] - cz) * s];
  const pending = new Set(learning.pendingNodeIds());
  const hintSp = state.stage?.spots.find((sp) => sp.item === learning.hintItem());
  let html = `<polyline class="path all" points="${nodes.map((n) => mapProj(n.position).join(',')).join(' ')}"/>`;
  html += `<polyline class="path" points="${focus.map((n) => mapProj(n.position).join(',')).join(' ')}"/>`;
  html += '<path id="map-cone" class="cone" d=""/>';
  for (const n of nodes) {
    const [x, y] = mapProj(n.position);
    const on = ids.includes(n.id);
    const cls = ['node', on ? '' : 'off', pending.has(n.id) ? 'has-item' : ''].join(' ');
    const title = on ? `<title>${num(ids.indexOf(n.id) + 1)}</title>` : '';
    if (hintSp?.node === n.id) html += `<circle class="hint-ring" cx="${x}" cy="${y}" r="11"/>`;
    const attrs = on ? `data-id="${n.id}" role="button" tabindex="-1"` : 'aria-hidden="true"';
    html += `<circle class="${cls}" ${attrs} cx="${x}" cy="${y}" r="${on ? 8 : 3.5}">${title}</circle>`;
  }
  svg.innerHTML = html;
  svg.querySelectorAll('[data-id]').forEach((c) => c.addEventListener('click', () => goTo(c.dataset.id)));
  updateMinimap(true);
}
function updateMinimap(force) {
  if (!mapProj || !state.node) return;
  const p = camera.getPosition();
  const [x, y] = mapProj([p.x, 0, p.z]);
  const r = 24, half = (view.fov / 2) * DEG, a = view.yaw * DEG;
  const pt = (ang) => [x - Math.sin(ang) * r, y - Math.cos(ang) * r];
  const [x1, y1] = pt(a - half), [x2, y2] = pt(a + half);
  $('#map-cone').setAttribute('d', `M${x},${y} L${x1},${y1} A${r},${r} 0 0 0 ${x2},${y2} Z`);
  if (force || updateMinimap.cur !== state.node.id) {
    updateMinimap.cur = state.node.id;
    document.querySelectorAll('#map-svg [data-id]').forEach((c) => c.classList.toggle('current', c.dataset.id === state.node.id));
  }
}
function refreshLearningViews() { buildHotspots(); buildMinimap(); }

// ---------------------------------------------------------------- navigation
let enterSeq = 0;                     // a newer enterNode (or leaving the tour) cancels an older one still loading
async function enterNode(node, { faceYaw } = {}) {
  const my = ++enterSeq;
  state.node = node;
  state.offset = [0, 0, 0];
  setCamPos(node.position);
  status(t('loading'));
  const tex = await bestTexture(node, 1500);
  status('');
  if (my !== enterSeq || state.screen !== 'tour') return false;
  pano.a = tex; pano.yawA = node.yaw; pano.mix = 0; syncPano();
  panoTexture(node, (full) => { if (state.node === node && pano.a !== full && !state.busy) { pano.a = full; syncPano(); } });
  if (faceYaw !== undefined) view.yaw = faceYaw;
  applyView();
  if (isKey(node)) {
    ensureSplat(node).then((s) => { if (state.node === node && state.screen === 'tour') setSplatFade(s, photoAtRest(node) ? 0 : 1); }).catch((e) => console.warn(e));
  }
  afterArrive();
  return true;
}

function afterArrive() {
  const n = state.node;
  updateWhere();
  buildHotspots();
  buildMinimap();
  // prefetch neighbour photos; splats for key spots within two hops (inside the stage)
  const keep = new Set();
  const ids = pathIds(), i = ids.indexOf(n.id);
  for (let j = i - 2; j <= i + 2; j++) {
    const m = nodeById(ids[j]);
    if (!m) continue;
    if (Math.abs(j - i) === 1) panoTexture(m);
    if (isKey(m)) { keep.add(m.id); ensureSplat(m).catch(() => {}); }
  }
  pruneSplats(keep);
  if (!align.on) try { history.replaceState(null, '', `?${state.stage ? `stage=${state.stage.id}&` : ''}node=${n.id}`); } catch { /* file:// */ }
}

function animate(ms, fn) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      const k = clamp((performance.now() - t0) / ms, 0, 1);
      fn(k);
      if (k < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

async function goTo(targetId) {
  if (state.busy || state.screen !== 'tour' || !state.node || targetId === state.node.id || topModal() || !inPath(targetId)) return;
  // walk hop by hop along the capture path, so every 3DGS move is a short plausible segment
  const ids = pathIds();
  const i0 = ids.indexOf(state.node.id), i1 = ids.indexOf(targetId);
  const dir = Math.sign(i1 - i0), hops = Math.abs(i1 - i0);
  for (let i = i0 + dir, h = 0; h < hops; i += dir, h++) {
    await moveTo(nodeById(ids[i]), { fast: hops > 1, last: h === hops - 1 });
  }
}

async function moveTo(B, { fast = false, last = true } = {}) {
  const A = state.node;
  state.busy = true;
  clearHotspots();
  $('#walk-pad').classList.add('hidden');
  const c = camera.getPosition();
  const pa = [c.x, c.y, c.z], pb = B.position;
  const d = [pb[0] - A.position[0], 0, pb[2] - A.position[2]];
  const dist = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
  const headYaw = camYawFor(d);
  const yaw0 = view.yaw, pitch0 = view.pitch, fov0 = view.fov;
  const texBP = bestTexture(B, fast ? 400 : 900);

  const sA = isKey(A) ? splats.get(A.id) : null;
  let sB = null;
  if (isKey(B)) {
    const slow = setTimeout(() => status(t('loading')), 250);
    try { sB = await ensureSplat(B); } catch (e) { console.warn('splat load failed; staying on the photo', e); }
    clearTimeout(slow); status('');
  }
  const fA0 = sA?.entity ? sA.fade : 0;
  const restB = !last || !sB ? false : photoAtRest(B);
  pano.b = await texBP; pano.yawB = B.yaw; pano.mix = 0; syncPano();

  if (!reducedMotion.matches && (sA?.entity || sB?.entity)) {
    // A move that touches a 3D zone: one continuous camera flight through the splat(s).
    const dur = (fast ? 0.55 : 1) * clamp(1100 + dist * 160, 1400, 2800);
    await animate(dur, (k) => {
      const e = easeInOut(k);
      setCamPos([lerp(pa[0], pb[0], e), lerp(pa[1], pb[1], e), lerp(pa[2], pb[2], e)]);
      const turn = smooth(0, 0.45, k);
      view.yaw = yaw0 + angDiff(yaw0, headYaw) * turn;
      view.pitch = lerp(pitch0, -4, turn);
      view.fov = lerp(fov0, 75, turn);
      applyView();
      if (sA?.entity) setSplatFade(sA, Math.max(fA0, smooth(0, 0.12, k)) * (1 - smooth(0.45, 0.8, k)));
      if (sB?.entity) setSplatFade(sB, smooth(0.15, 0.5, k) * (restB ? 1 - smooth(0.84, 1, k) : 1));
      pano.mix = smooth(0.35, 0.75, k); syncPano();
    });
  } else {
    // 360 -> 360 (or reduced motion): the camera does not turn or zoom. The old photo is pushed
    // forward along the walking direction while the new one settles in from slightly behind,
    // so it reads as one step forward without the view swaying.
    const len = Math.hypot(d[0], d[2]) || 1;
    pano.travel = [d[0] / len, 0, d[2] / len];
    const motion = !reducedMotion.matches;
    const dur = motion ? (fast ? 300 : 520) : 280;
    await animate(dur, (k) => {
      const e = 1 - Math.pow(1 - k, 3);                     // ease-out: quick start, soft landing
      if (motion) { pano.zoomA = 1 + 0.45 * e; pano.zoomB = 0.86 + 0.14 * e; }
      if (sA?.entity) setSplatFade(sA, fA0 * (1 - smooth(0, 0.5, k)));
      pano.mix = smooth(0.08, 0.8, k); syncPano();
      if (k > 0.5 && state.node !== B) { setCamPos(pb); state.node = B; }
    });
    pano.zoomA = 1; pano.zoomB = 1;
    if (sB?.entity) setSplatFade(sB, restB ? 0 : 1);
  }
  if (sA?.entity) setSplatFade(sA, 0);
  if (sB?.entity && restB) setSplatFade(sB, 0);
  pano.a = pano.b; pano.yawA = pano.yawB; pano.mix = 0; syncPano();
  state.node = B;
  state.offset = [0, 0, 0];
  setCamPos(pb);
  settleSplats();
  panoTexture(B, (full) => { if (state.node === B && !state.busy && pano.a !== full) { pano.a = full; syncPano(); } });
  state.busy = false;
  if (last) afterArrive(); else updateWhere();
}

function stepPath(dir) {
  const ids = pathIds(), i = ids.indexOf(state.node.id) + dir;
  if (i >= 0 && i < ids.length) goTo(ids[i]);
}

// ---------------------------------------------------------------- walking inside a 3D zone
const walk = { keys: new Set(), pad: new Set() };
const WALK_R = 3.0;      // default: a proxy splat holds up within a few metres of the capture point (tour.json walkRadius overrides)
function updateWalk(dt) {
  const n = state.node;
  if (state.screen !== 'tour' || state.busy || !isKey(n)) return;
  const s = splats.get(n.id);
  const k = walk.keys, p = walk.pad;
  let f = 0, r = 0;
  if (!topModal()) {
    if (k.has('KeyW') || k.has('ArrowUp') || p.has('f')) f += 1;
    if (k.has('KeyS') || k.has('ArrowDown') || p.has('b')) f -= 1;
    if (k.has('KeyD') || k.has('ArrowRight') || p.has('r')) r += 1;
    if (k.has('KeyA') || k.has('ArrowLeft') || p.has('l')) r -= 1;
  }
  const o = state.offset;
  if ((f || r) && s?.entity) {
    const speed = 1.5 * dt, yaw = view.yaw * DEG;
    const fw = [-Math.sin(yaw), -Math.cos(yaw)], rt = [Math.cos(yaw), -Math.sin(yaw)];
    o[0] += (fw[0] * f + rt[0] * r) * speed;
    o[2] += (fw[1] * f + rt[1] * r) * speed;
    const len = Math.hypot(o[0], o[2]);
    const R = n.walkRadius || WALK_R;
    if (len > R) { o[0] *= R / len; o[2] *= R / len; }
    setCamPos([n.position[0] + o[0], n.position[1], n.position[2] + o[2]]);
  }
  if (s?.entity) {
    // proxy splats: crisp photo on the capture point, 3DGS as soon as you step away
    const target = align.on ? (align.show ? 1 : 0) : photoAtRest(n) ? smooth(0.04, 0.5, Math.hypot(o[0], o[2])) : 1;
    if (Math.abs(target - s.fade) > 1e-3) setSplatFade(s, target); else settleSplats();
  }
}

// ---------------------------------------------------------------- input
const pointers = new Map();
let pinch0 = null, inertia = { yaw: 0, pitch: 0 }, lastMove = 0;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.classList.add('dragging');
  inertia = { yaw: 0, pitch: 0 };
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), fov: view.fov }; }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  if (pointers.size === 2 && pinch0) {
    p.x = e.clientX; p.y = e.clientY;
    const [a, b] = [...pointers.values()];
    view.fov = clamp(pinch0.fov * pinch0.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 35, 95);
    applyView(); return;
  }
  if (state.busy) { p.x = e.clientX; p.y = e.clientY; return; }
  const k = 0.12 * (view.fov / 75);
  const dy = (e.clientX - p.x) * k, dp = (e.clientY - p.y) * k;
  view.yaw += dy; view.pitch = clamp(view.pitch + dp, -85, 85);
  inertia = { yaw: dy, pitch: dp }; lastMove = performance.now();
  p.x = e.clientX; p.y = e.clientY;
  applyView();
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch0 = null;
  if (!pointers.size) { canvas.classList.remove('dragging'); if (performance.now() - lastMove > 60) inertia = { yaw: 0, pitch: 0 }; }
};
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); view.fov = clamp(view.fov * Math.exp(e.deltaY * 0.001), 35, 95); applyView(); }, { passive: false });
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (!$('#lang-menu').classList.contains('hidden')) { toggleLangMenu(false); $('#btn-lang').focus(); return; }
    const m = topModal();
    if (m?.id === 'word-card') learning.closeWord(); else if (m) closeModal(m);
    return;
  }
  if (state.screen !== 'tour' || topModal() || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
  if (isKey(state.node) && /^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) { walk.keys.add(e.code); e.preventDefault(); return; }
  if (state.busy) return;
  if (e.code === 'ArrowLeft') { view.yaw += 5; applyView(); }
  if (e.code === 'ArrowRight') { view.yaw -= 5; applyView(); }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') stepPath(1);
  if (e.code === 'ArrowDown' || e.code === 'KeyS') stepPath(-1);
});
window.addEventListener('keyup', (e) => walk.keys.delete(e.code));
window.addEventListener('blur', () => { walk.keys.clear(); walk.pad.clear(); });
document.querySelectorAll('#walk-pad [data-move]').forEach((b) => {
  const m = b.dataset.move;
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); walk.pad.add(m); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => b.addEventListener(ev, () => walk.pad.delete(m)));
  b.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); walk.pad.add(m); } });
  b.addEventListener('keyup', () => walk.pad.delete(m));
});

// ---------------------------------------------------------------- frame loop
app.on('update', (dt) => {
  if (!pointers.size && (Math.abs(inertia.yaw) > 0.01 || Math.abs(inertia.pitch) > 0.01) && !state.busy) {
    view.yaw += inertia.yaw; view.pitch = clamp(view.pitch + inertia.pitch, -85, 85);
    inertia.yaw *= 0.9; inertia.pitch *= 0.9; applyView();
  }
  updateWalk(dt);
  updateHotspots();
  updateMinimap();
});

// ---------------------------------------------------------------- alignment mode (developer tool, see align.js)
const align = createAlign({ nodeById, params, splats, applySplatTransform, workBufferAlways: WB_ALWAYS, toast });

// ---------------------------------------------------------------- screens
function showTourUI(on) {
  document.body.classList.toggle('in-tour', on);
  $('#landing').classList.toggle('hidden', on);
}
// first view on a spot: towards its first hotspot still to find (else any hotspot, else the next spot)
function faceYawFor(node) {
  const here = (state.stage?.spots || []).filter((sp) => sp.node === node.id);
  const sp = here.find((x) => learning.itemState(x.item) === 'active') || here[0];
  if (sp) return camYawFor(rotY(localDir(sp.u, 0.5), node.yaw));
  const ids = pathIds(), nxt = nodeById(ids[ids.indexOf(node.id) + 1]);
  return camYawFor(nxt ? [nxt.position[0] - node.position[0], 0, nxt.position[2] - node.position[2]] : rotY([0, 0, -1], node.yaw));
}
// open a stage (stageId null = the whole path, used by align mode) at its start or at nodeId
async function startStage(stageId, nodeId, { intro = true } = {}) {
  if (state.busy) return;
  state.stage = state.tour.stages.find((s) => s.id === stageId) || null;
  learning.setStage(state.stage?.id);
  state.screen = 'tour';
  showTourUI(true);
  const node = (nodeId && inPath(nodeId) && nodeById(nodeId)) || nodeById(state.stage?.start || state.tour.start);
  view.pitch = -4; view.fov = 75;
  if (!(await enterNode(node, { faceYaw: faceYawFor(node) }))) return;
  if (intro && state.stage) learning.showIntro();
}
function toLanding() {
  if (state.busy) return;
  enterSeq++;
  stopVoice();
  learning.setStage(null);              // also drops a game queued to open after the last word card
  for (const id of ['stage-intro', 'word-card', 'activity', 'passport']) closeModal($('#' + id));
  state.screen = 'landing';
  clearHotspots();
  for (const s of splats.values()) setSplatFade(s, 0);
  showTourUI(false);
  learning.renderLanding();
  try { history.replaceState(null, '', location.pathname); } catch { /* file:// */ }
  ($(`.stage-card[data-stage="${state.stage?.id}"]`) || $('.stage-card'))?.focus();
}
function toggleLangMenu(open) {
  const menu = $('#lang-menu');
  const on = open ?? menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !on);
  $('#btn-lang').setAttribute('aria-expanded', String(on));
  if (on) menu.querySelector('.on')?.focus();
}
function pickLang(e) {
  const b = e.target.closest('[data-lang]');
  if (!b) return;
  setLangValue(b.dataset.lang);
  toggleLangMenu(false);
  applyI18n();
}

// ---------------------------------------------------------------- boot
try {
  const res = await fetch('assets/tour.json', { cache: 'no-cache' });      // always ask whether it changed (a deploy may be minutes old)
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  state.tour = await res.json();
} catch (err) {
  $('#landing').insertAdjacentHTML('beforeend', `<p class="pp-msg">assets/tour.json could not be loaded (${esc(err.message)}). Run tools/make_splats.py and serve the folder with node serve.mjs.</p>`);
  throw err;
}
setAudioIndex(state.tour.audio);
learning = createLearning({
  tour: state.tour, refresh: refreshLearningViews, toast,
  onPickStage: (id) => startStage(id),
  onLeaveStage: toLanding,
});

$('#btn-reset').addEventListener('click', () => openModal($('#reset-ask'), '#ra-no'));
$('#ra-no').addEventListener('click', () => closeModal($('#reset-ask')));
$('#ra-yes').addEventListener('click', () => {
  closeModal($('#reset-ask'));
  learning.reset();
  state.node = null;
  $('.stage-card')?.focus();
});
$('#btn-home').addEventListener('click', toLanding);
$('#btn-passport').addEventListener('click', () => learning.openPassport());
$('#landing-passport').addEventListener('click', () => learning.openPassport());
$('#btn-lang').addEventListener('click', () => toggleLangMenu());
$('#lang-menu').addEventListener('click', pickLang);
$('#lang-chips').addEventListener('click', pickLang);
document.addEventListener('pointerdown', (e) => { if (!e.target.closest?.('#lang-menu, #btn-lang')) toggleLangMenu(false); });
// a backdrop click closes a modal only if the press also started on the backdrop
let pressedOn = null;
document.addEventListener('pointerdown', (e) => { pressedOn = e.target; }, true);
['word-card', 'activity', 'passport', 'stage-intro', 'reset-ask'].forEach((id) => $('#' + id).addEventListener('click', (e) => {
  if (e.target.id !== id || pressedOn !== e.target) return;
  if (id === 'word-card') learning.closeWord(); else closeModal(e.target);
}));
document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
// phones: the mission is a bottom sheet; the 3D walk pad sits just above it
new ResizeObserver(([e]) => document.documentElement.style.setProperty('--sheet-h', `${Math.ceil(e.target.offsetHeight)}px`)).observe($('#mission'));

applyI18n();
if (params.get('align')) {
  align.setup(params.get('align'));
  if (align.on) startStage(null, align.node.id, { intro: false }).then(() => ensureSplat(align.node)).then(align.render).catch((e) => console.warn(e));
} else {
  // deep links: ?stage=<id>[&node=<id>] or ?node=<id> (opens the stage that contains the spot)
  const nodeParam = params.get('node');
  const st = state.tour.stages.find((s) => s.id === params.get('stage')) || state.tour.stages.find((s) => s.nodes.includes(nodeParam));
  if (st) startStage(st.id, nodeParam, { intro: !nodeParam });
}
window.__cev = { app, state, view, goTo, splats, pano, camera, learning, startStage };
