import { store, save, addStars } from './store.js';
import { sfx, speak } from './audio.js';
import { h, topbar, confetti, modal, toast, refreshStars, cheer, starRow } from './ui.js';
import { mountTracer, LEVELS } from './trace.js';
import { PICTURES, PIC_BY } from './pictures.js';
import { chars, charEl, outline, fileToCanvas } from './chars.js';
import { floodFill, hexRgb } from './fill.js';

let photo = null; // 마지막으로 고른 사진 { url, img } (앱을 닫으면 사라짐, 저장 안 함)

const loadImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

// ============ 그림 고르기 ============
export function picker(go) {
  const fin = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fin.addEventListener('change', async () => {
    const f = fin.files && fin.files[0];
    if (!f) return;
    try {
      const cv = await fileToCanvas(f, 1200);
      const url = cv.toDataURL('image/jpeg', 0.9);
      photo = { url, img: await loadImg(url) };
      m.close(); go('draw', { photo: true });
    } catch { toast('사진을 열 수 없어요'); }
  });
  const picGrid = h('div', { class: 'pickgrid' }, PICTURES.map((p) => h('button', {
    class: 'pickc' + (store.pics[p.id] ? ' got' : ''), onclick: () => { sfx('tap'); m.close(); go('picture', { id: p.id }); },
  }, h('span', { class: 'pke' }, p.emoji), h('span', { class: 'pkn' }, p.name))));
  const myGrid = h('div', { class: 'pickgrid' },
    chars().map((c) => h('button', { class: 'pickc', onclick: () => { sfx('tap'); m.close(); go('draw', { char: c.id }); } },
      charEl(c, 'pki'), h('span', { class: 'pkn' }, c.name || ''))),
    h('button', { class: 'pickc photo', onclick: () => fin.click() }, h('span', { class: 'pke' }, '📷'), h('span', { class: 'pkn' }, '사진 고르기')));
  const m = modal(h('div', { class: 'picker' },
    h('div', { class: 'pkt' }, '✏️ 따라 그리기'), picGrid,
    h('div', { class: 'pkt' }, '🖼️ 사진 위에 그리기'), myGrid, fin));
  return m;
}

// ============ 그림 따라 그리기 ============
export function pictureScreen(go, { id }) {
  const P = PIC_BY[id] || PICTURES[0];
  const stage = h('div', { class: 'tstage' });
  let tr, timer;
  const next = () => PICTURES[(PICTURES.indexOf(P) + 1) % PICTURES.length];
  const bar = h('div', { class: 'bar' },
    h('button', { class: 'btn round', onclick: () => speak(P.name + ' 그려 볼까?') }, '🔊'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); tr.reset(); } }, '🔄'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); go('draw', { pic: P.id, fill: true }); } }, '🎨'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); go('picture', { id: next().id }); } }, '⏭️'));
  const el = h('div', { class: 'screen lay' },
    topbar(go, { title: P.emoji + ' ' + P.name, right: h('button', { class: 'btn sq', onclick: () => picker(go) }, '🖼️') }), stage, bar);
  // 그림은 정해진 획 순서가 없으므로 순서·방향은 따지지 않고 정확도만 난이도를 따름
  const lv = LEVELS[store.settings.level] || LEVELS.easy;
  tr = mountTracer(stage, P.strokes, {
    ...lv, order: false, dir: false,
    onStroke: () => sfx('stroke'),
    onRetry: () => { sfx('soft'); speak('선을 따라 천천히 한 번 더!'); toast('한 번 더! 💪'); },
    onDone: ({ stars }) => {
      sfx('win'); confetti();
      store.pics[P.id] = (store.pics[P.id] || 0) + 1;
      addStars(stars); refreshStars(); save();
      timer = setTimeout(() => speak(`${P.name} 완성! 멋져요!`), 800);
      const m = modal(h('div', { class: 'reward' },
        h('div', { class: 'got' }, '완성!'), starRow(stars),
        h('div', { class: 'row' }, h('div', { class: 'bigemo bounce' }, P.emoji), cheer()),
        h('div', { class: 'cap' }, P.name),
        h('div', { class: 'row' },
          h('button', { class: 'btn round', onclick: () => { m.close(); go('picture', { id: P.id }); } }, '🔁'),
          h('button', { class: 'btn round', onclick: () => { m.close(); go('draw', { pic: P.id, fill: true }); } }, '🎨'),
          h('button', { class: 'btn round primary', onclick: () => { m.close(); go('picture', { id: next().id }); } }, '➡️'))),
      { dismiss: false });
    },
  });
  timer = setTimeout(() => speak(P.name + ' 그려 볼까?'), 400);
  return { el, cleanup: () => { clearTimeout(timer); tr.destroy(); } };
}

// ============ 그리기 (자유 / 밑그림 위에) ============
const STAMPS = ['🦖', '🚗', '🐘', '🚒', '🦁', '🚀', '🐢', '🚜', '🦕', '🐯', '✈️', '🐧'];
// 팔레트 32색: 진한 색 / 연한 색 / 살구·갈색 계열 / 흰·회·검
const PALETTE = [
  '#e03131', '#f76707', '#f59f00', '#fab005', '#2f9e44', '#0ca678', '#1971c2', '#1098ad',
  '#6741d9', '#ae3ec9', '#d6336c', '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9',
  '#4dabf7', '#3bc9db', '#9775fa', '#e599f7', '#f783ac', '#ffc9c9', '#ffe8cc', '#fff3bf',
  '#f4c7a1', '#e0a370', '#a0522d', '#6f4518', '#ffffff', '#adb5bd', '#495057', '#212529',
];
const RECENT_DEFAULT = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
// 🌈로 채울 때 차례로 쓰는 밝은 색
const FILLS = ['#ff8787', '#ffc078', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc', '#f783ac', '#63e6be'];
const UNDO_MAX = 10, UNDO_BYTES = 60e6; // 되돌리기: 최대 10번, 메모리 60MB까지
const ZMAX = 4;

export function drawScreen(go, arg = {}) {
  let col = 'rainbow', size = 16, mode = arg.fill ? 'fill' : 'brush', hue = 0, down = false, last = null, pid = null;
  let fillN = 0, undos = [], pre = null, box = null;
  // 확대: 화면 = 그림판 좌표 × z + (tx, ty)
  let z = 1, tx = 0, ty = 0;
  const pts = new Map(); // 화면에 닿은 손가락들
  let gest = null, lockUntilUp = false, tap = null;
  // 밑그림 정하기
  let bg = null;
  if (arg.pic && PIC_BY[arg.pic]) bg = { kind: 'pic', p: PIC_BY[arg.pic] };
  else if (arg.char) { const c = chars().find((x) => x.id === arg.char); if (c && c.img) bg = { kind: 'img', img: c.img }; }
  else if (arg.photo && photo) bg = { kind: 'img', img: photo.img };
  let lineMode = false, praised = false;

  const bgc = h('canvas', { class: 'dcanvas bgc' });
  const cv = h('canvas', { class: 'dcanvas' });
  const stage = h('div', { class: 'dstage' }, bgc, cv);
  const zlabel = h('button', { class: 'zbtn zl', onclick: () => { sfx('tap'); setZoom(1); } }, '1×');
  const zoomCtl = h('div', { class: 'zoomctl' },
    h('button', { class: 'zbtn', onclick: () => { sfx('tap'); zoomBy(1 / 1.5); } }, '➖'), zlabel,
    h('button', { class: 'zbtn', onclick: () => { sfx('tap'); zoomBy(1.5); } }, '➕'));
  const wrap = h('div', { class: 'dwrap' }, stage, zoomCtl);
  const ctx = cv.getContext('2d'), bctx = bgc.getContext('2d');

  // ---- 색: 🌈 + 최근 6색 + 🎨 팔레트 ----
  const recent = () => (Array.isArray(store.recentCols) && store.recentCols.length ? store.recentCols : RECENT_DEFAULT).slice(0, 6);
  const pickCol = (c) => {
    col = c; if (mode === 'stamp' || mode === 'erase') mode = 'brush';
    if (c !== 'rainbow') { store.recentCols = [c, ...recent().filter((x) => x !== c)].slice(0, 6); save(); }
    sync();
  };
  const colRow = h('div', { class: 'colrow' });
  const renderCols = () => {
    colRow.innerHTML = '';
    ['rainbow', ...recent()].forEach((c) => colRow.append(h('button', {
      class: 'cbtn' + (c === col && mode !== 'stamp' && mode !== 'erase' ? ' on' : '') + (c === '#ffffff' ? ' white' : ''),
      style: c === 'rainbow' ? '' : `background:${c}`, onclick: () => { sfx('tap'); pickCol(c); },
    }, c === 'rainbow' ? '🌈' : '')));
  };
  const palBtn = h('button', { class: 'btn sq', onclick: () => {
    sfx('tap');
    const m = modal(h('div', { class: 'palette' },
      h('div', { class: 'pkt' }, '🎨 색 고르기'),
      h('div', { class: 'palgrid' }, PALETTE.map((c) => h('button', {
        class: 'pcol' + (c === col ? ' on' : '') + (c === '#ffffff' ? ' white' : ''), style: `background:${c}`,
        onclick: () => { sfx('tap'); m.close(); pickCol(c); },
      })))));
  } }, '🎨');
  const sizeBtn = h('button', { class: 'btn sq', onclick: () => { size = size === 16 ? 34 : 16; if (mode !== 'brush' && mode !== 'erase') mode = 'brush'; sync(); } }, '●');
  const eraseBtn = h('button', { class: 'btn sq', onclick: () => { sfx('tap'); mode = mode === 'erase' ? 'brush' : 'erase'; sync(); } }, '🧽');
  const stampBtn = h('button', { class: 'btn sq', onclick: () => { mode = mode === 'stamp' ? 'brush' : 'stamp'; sync(); } }, '🦖');
  const fillBtn = h('button', { class: 'btn sq', onclick: () => { sfx('tap'); mode = mode === 'fill' ? 'brush' : 'fill'; sync(); } }, '🪣');
  const undoBtn = h('button', { class: 'btn sq', onclick: () => undo() }, '↩️');
  const clr = h('button', { class: 'btn sq', onclick: () => {
    sfx('pop'); pushUndo({ x: 0, y: 0, w: cv.width, h: cv.height, data: ctx.getImageData(0, 0, cv.width, cv.height) });
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
  } }, '🗑️');
  const lineBtn = bg && bg.kind === 'img' ? h('button', { class: 'btn sq', onclick: () => { lineMode = !lineMode; sfx('tap'); paintBg(); sync(); } }, '✏️') : null;
  const doneBtn = bg ? h('button', { class: 'btn sq', onclick: () => {
    if (praised) { sfx('star'); return; }
    praised = true; sfx('win'); confetti(); addStars(1); refreshStars(); setTimeout(() => { if (el.isConnected) speak('우와! 멋지게 그렸어요!'); }, 800);
  } }, '⭐') : null;
  const bar = h('div', { class: 'bar dbar' }, colRow, palBtn, sizeBtn, fillBtn, eraseBtn, stampBtn, lineBtn, doneBtn, undoBtn, clr);
  const sync = () => {
    renderCols();
    sizeBtn.style.fontSize = size === 16 ? '20px' : '40px'; stampBtn.classList.toggle('on', mode === 'stamp');
    fillBtn.classList.toggle('on', mode === 'fill'); eraseBtn.classList.toggle('on', mode === 'erase');
    undoBtn.disabled = !undos.length; undoBtn.style.opacity = undos.length ? 1 : 0.4;
    if (lineBtn) lineBtn.classList.toggle('on', lineMode);
  };
  const right = h('div', { class: 'row' },
    bg ? h('button', { class: 'btn sq', onclick: () => { sfx('tap'); go('draw'); } }, '⬜') : null,
    h('button', { class: 'btn sq', onclick: () => picker(go) }, '🖼️'));
  const el = h('div', { class: 'screen lay' }, topbar(go, { title: '', right }), wrap, bar);

  let W = 0, H = 0, lineCache = null;
  function paintBg() {
    const d = Math.min(devicePixelRatio || 1, 2);
    bctx.setTransform(d, 0, 0, d, 0, 0);
    bctx.clearRect(0, 0, W, H);
    if (!bg) return;
    if (bg.kind === 'pic') {
      const s = Math.min(W, H) * 0.92, ox = (W - s) / 2, oy = (H - s) / 2;
      bctx.lineCap = bctx.lineJoin = 'round'; bctx.lineWidth = Math.max(6, s / 70); bctx.strokeStyle = '#adb5bd';
      bg.p.strokes.forEach((st) => {
        bctx.beginPath();
        st.forEach(([x, y], i) => (i ? bctx.lineTo(ox + (x / 100) * s, oy + (y / 100) * s) : bctx.moveTo(ox + (x / 100) * s, oy + (y / 100) * s)));
        bctx.stroke();
      });
      return;
    }
    const im = bg.img, k = Math.min(W / im.naturalWidth, H / im.naturalHeight) * 0.95;
    const dw = im.naturalWidth * k, dh = im.naturalHeight * k, x = (W - dw) / 2, y = (H - dh) / 2;
    if (lineMode) {
      const key = Math.round(dw) + 'x' + Math.round(dh);
      if (!lineCache || lineCache.key !== key) lineCache = { key, cv: outline(im, Math.round(dw), Math.round(dh)) };
      bctx.drawImage(lineCache.cv, x, y, dw, dh);
    } else {
      bctx.globalAlpha = 0.35; bctx.drawImage(im, x, y, dw, dh); bctx.globalAlpha = 1;
    }
  }

  // ---- 확대·이동 ----
  function applyZoom() {
    // 그림판이 화면을 벗어나 빈 곳이 보이지 않게
    tx = Math.min(0, Math.max(W - W * z, tx)); ty = Math.min(0, Math.max(H - H * z, ty));
    stage.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
    zlabel.textContent = (Math.round(z * 10) / 10) + '×';
    zoomCtl.classList.toggle('zoomed', z > 1.01);
  }
  // 화면 위 (sx, sy) 지점을 그대로 둔 채 배율 바꾸기
  function zoomAt(nz, sx, sy) {
    nz = Math.max(1, Math.min(ZMAX, nz));
    const px = (sx - tx) / z, py = (sy - ty) / z;
    z = nz; tx = sx - px * z; ty = sy - py * z; applyZoom();
  }
  const zoomBy = (f) => zoomAt(z * f, W / 2, H / 2);
  const setZoom = (nz) => zoomAt(nz, W / 2, H / 2);

  const fit = () => {
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    if (!w || !hh) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    const keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height;
    if (cv.width) keep.getContext('2d').drawImage(cv, 0, 0);
    for (const c of [cv, bgc]) { c.width = Math.round(w * d); c.height = Math.round(hh * d); c.style.width = w + 'px'; c.style.height = hh + 'px'; }
    stage.style.width = w + 'px'; stage.style.height = hh + 'px';
    if (keep.width) ctx.drawImage(keep, 0, 0);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    W = w; H = hh; paintBg();
    z = 1; tx = ty = 0; applyZoom();
  };
  const ro = new ResizeObserver(fit); ro.observe(wrap);

  // ---- 되돌리기: 바뀐 사각형만 저장 ----
  function pushUndo(u) {
    if (!u) return;
    undos.push(u);
    let bytes = undos.reduce((a, x) => a + x.data.data.length, 0);
    while (undos.length > UNDO_MAX || (bytes > UNDO_BYTES && undos.length > 1)) bytes -= undos.shift().data.data.length;
    sync();
  }
  function undo() {
    const u = undos.pop();
    if (!u) { sfx('boing'); return; }
    sfx('tap'); ctx.putImageData(u.data, u.x, u.y); sync();
  }
  const dpr = () => cv.width / (W || 1);
  // 그리기 시작 전 상태를 들고 있다가, 끝나면 그린 범위만 잘라 저장
  const grow = (p, r) => { box = box ? [Math.min(box[0], p.x - r), Math.min(box[1], p.y - r), Math.max(box[2], p.x + r), Math.max(box[3], p.y + r)] : [p.x - r, p.y - r, p.x + r, p.y + r]; };
  function endStroke() {
    if (!pre || !box) { pre = box = null; return; }
    const k = dpr();
    const x = Math.max(0, Math.floor(box[0] * k)), y = Math.max(0, Math.floor(box[1] * k));
    const w = Math.min(cv.width, Math.ceil(box[2] * k)) - x, hh = Math.min(cv.height, Math.ceil(box[3] * k)) - y;
    if (w > 0 && hh > 0) {
      const t = document.createElement('canvas'); t.width = cv.width; t.height = cv.height;
      const tc = t.getContext('2d'); tc.putImageData(pre, 0, 0);
      pushUndo({ x, y, w, h: hh, data: tc.getImageData(x, y, w, hh) });
    }
    pre = box = null;
  }
  // 두 손가락이 닿으면 그리던 선은 없던 일로
  function cancelStroke() {
    if (down && pre) ctx.putImageData(pre, 0, 0);
    down = false; pid = null; pre = box = null;
  }

  function doFill(p) {
    const k = dpr();
    const c = col === 'rainbow' ? FILLS[fillN++ % FILLS.length] : col;
    const useBg = !!bg && (bg.kind === 'pic' || lineMode);
    const u = floodFill(ctx, bctx, p.x * k, p.y * k, hexRgb(c), useBg);
    if (u) { pushUndo(u); sfx('fill'); } else sfx('boing');
  }
  function doStamp(p) {
    pre = ctx.getImageData(0, 0, cv.width, cv.height); box = null;
    const sz = 110 / z; // 화면에서 같은 크기
    grow(p, sz * 0.6);
    ctx.globalCompositeOperation = 'source-over';
    // 도장: 이모지 + 내 캐릭터 중에서 무작위
    const mine = chars().filter((c) => c.img);
    const n = STAMPS.length + mine.length, r = Math.floor(Math.random() * n);
    if (r >= STAMPS.length) {
      const im = mine[r - STAMPS.length].img, s = sz / Math.max(im.naturalWidth, im.naturalHeight);
      ctx.drawImage(im, p.x - (im.naturalWidth * s) / 2, p.y - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
    } else {
      ctx.font = Math.round(sz * 0.82) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(STAMPS[r], p.x, p.y);
    }
    sfx('tap'); endStroke();
  }
  // 화면 좌표 → 그림판 좌표
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / z, y: (e.clientY - r.top) / z }; };
  const wpos = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const lw = () => size / z; // 확대해도 화면에서 같은 굵기
  const style = () => {
    ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = lw();
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = mode === 'erase' ? '#000' : col === 'rainbow' ? `hsl(${hue} 90% 55%)` : col;
  };
  const twoFinger = () => {
    const [a, b] = [...pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  };

  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { cv.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    pts.set(e.pointerId, wpos(e));
    if (pts.size >= 2) {
      // 두 손가락: 확대·이동 시작
      cancelStroke(); tap = null; lockUntilUp = true;
      const g = twoFinger();
      gest = { d0: g.d, z0: z, px: (g.mx - tx) / z, py: (g.my - ty) / z };
      return;
    }
    if (lockUntilUp) return;
    last = pos(e);
    // 채우기·도장은 손가락을 뗄 때 (두 손가락 확대와 헷갈리지 않게)
    if (mode === 'fill' || mode === 'stamp') { tap = { id: e.pointerId, p: last, s: wpos(e) }; return; }
    down = true; pid = e.pointerId;
    pre = ctx.getImageData(0, 0, cv.width, cv.height); box = null;
    grow(last, lw()); style(); ctx.beginPath(); ctx.arc(last.x, last.y, lw() / 2, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  });
  cv.addEventListener('pointermove', (e) => {
    if (pts.has(e.pointerId)) pts.set(e.pointerId, wpos(e));
    if (gest && pts.size >= 2) {
      const g = twoFinger();
      z = Math.max(1, Math.min(ZMAX, gest.z0 * g.d / gest.d0));
      tx = g.mx - gest.px * z; ty = g.my - gest.py * z; applyZoom();
      return;
    }
    if (tap && e.pointerId === tap.id) { const w = wpos(e); if (Math.hypot(w.x - tap.s.x, w.y - tap.s.y) > 14) tap = null; return; }
    if (!down || e.pointerId !== pid) return;
    const p = pos(e); hue = (hue + 3) % 360; style(); grow(p, lw());
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) gest = null;
    if (!pts.size) lockUntilUp = false;
    if (tap && e.pointerId === tap.id) {
      const t = tap; tap = null;
      if (e.type === 'pointerup') { if (mode === 'fill') doFill(t.p); else if (mode === 'stamp') doStamp(t.p); }
      return;
    }
    if (e.pointerId === pid) { down = false; pid = null; endStroke(); ctx.globalCompositeOperation = 'source-over'; }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  sync();
  return { el, cleanup: () => ro.disconnect() };
}
