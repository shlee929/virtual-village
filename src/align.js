// Alignment mode (?align=<nodeId>[&splat=<url>]), a developer tool.
// For dropping in a trained splat: nudge it until it lines up with the 360 photo, then copy the JSON
// into tools/content.json (nodes[<id>].splat). Walk with WASD/arrows to check parallax.
import { $, esc, topModal } from './ui.js';

/**
 * @param {{ nodeById: (id: string) => object|undefined, params: URLSearchParams, splats: Map<string, object>,
 *           applySplatTransform: Function, workBufferAlways: number, toast: (msg: string, kind?: string) => void }} ctx
 */
export function createAlign({ nodeById, params, splats, applySplatTransform, workBufferAlways, toast }) {
  const align = { on: false, show: true, tr: null, node: null, crop: 0 };

  function toJSON() {
    const r = (x) => Math.round(x * 1000) / 1000;
    const n = align.node;
    return { file: n.splat, kind: n.splatKind || 'trained',
      transform: { position: align.tr.position.map(r), yaw: r(align.tr.yaw), scale: r(align.tr.scale), ...(align.tr.flip ? { flip: true } : {}) },
      crop: r(align.crop), walkRadius: n.walkRadius };
  }
  function render() {
    if (!align.on) return;
    $('#align-json').textContent = JSON.stringify(toJSON(), null, 1);
    const s = splats.get(align.node.id);
    if (s?.entity) {
      applySplatTransform(s.entity, align.node, align.tr);
      s.entity.gsplat.setParameter('uCropR', align.crop);
      s.entity.gsplat.workBufferUpdate = workBufferAlways; s.settled = false;
    }
  }
  async function copy() {
    const txt = JSON.stringify(toJSON(), null, 1);
    try { await navigator.clipboard.writeText(txt); toast('JSON을 복사했어요', 'ok'); } catch { toast('복사가 막혔어요. 패널의 JSON을 직접 선택해 복사하세요', 'warn'); }
  }
  function setup(id) {
    const n = nodeById(id);
    if (!n || n.media !== '3dgs') { console.warn('align: not a 3dgs node', id); return; }
    if (params.get('splat')) { n.splat = params.get('splat'); n.splatKind = 'trained'; n.splatTransform = { position: [0, 0, 0], yaw: 0, scale: 1 }; }
    const t0 = n.splatTransform || { position: [...n.position], yaw: n.yaw, scale: 1 };
    Object.assign(align, { on: true, node: n, crop: n.splatCrop || 0,
      tr: { position: [...(t0.position || n.position)], yaw: t0.yaw ?? n.yaw, scale: t0.scale || 1, flip: !!t0.flip } });
    n.walkRadius = Math.max(n.walkRadius || 0, 8);
    document.body.classList.add('aligning');
    const el = document.createElement('section');
    el.id = 'align-panel'; el.className = 'clay';
    el.innerHTML = `<h2>정렬 모드 · ${esc(id)}</h2><pre id="align-json"></pre>
      <p class="fine">J/L: x · I/K: z · U/O: y · Q/E: 회전 · Z/X: 크기 · V: 상하 뒤집기 · [ ]: 크롭 반경 · Shift: 미세 조정<br>T: 3DGS/사진 비교 · WASD/방향키: 걷기</p>
      <div class="row"><button class="btn btn-soft" id="align-toggle">T 비교</button><button class="btn btn-primary" id="align-copy">JSON 복사</button></div>`;
    document.body.appendChild(el);
    $('#align-toggle').addEventListener('click', () => { align.show = !align.show; });
    $('#align-copy').addEventListener('click', copy);
    render();
  }
  window.addEventListener('keydown', (e) => {
    if (!align.on || topModal()) return;
    const fine = e.shiftKey ? 0.1 : 1, tr = align.tr;
    const step = 0.2 * fine, rot = 2 * fine;
    const map = {
      KeyJ: () => (tr.position[0] -= step), KeyL: () => (tr.position[0] += step),
      KeyI: () => (tr.position[2] -= step), KeyK: () => (tr.position[2] += step),
      KeyU: () => (tr.position[1] += step), KeyO: () => (tr.position[1] -= step),
      KeyQ: () => (tr.yaw += rot), KeyE: () => (tr.yaw -= rot),
      KeyZ: () => (tr.scale *= 1 - 0.02 * fine), KeyX: () => (tr.scale *= 1 + 0.02 * fine), KeyV: () => (tr.flip = !tr.flip),
      BracketLeft: () => (align.crop = Math.max(0, align.crop - 2 * fine)), BracketRight: () => (align.crop += 2 * fine),
      KeyT: () => (align.show = !align.show), KeyC: () => copy(),
    };
    if (map[e.code]) { map[e.code](); render(); e.preventDefault(); }
  });
  return Object.assign(align, { setup, render });
}
