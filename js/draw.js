import { store, save, addStars } from './store.js';
import { sfx, speak, josa } from './audio.js';
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
    h('button', { class: 'btn round', onclick: () => speak(josa(P.name, '을', '를') + ' 그려 볼까?') }, '🔊'),
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
  timer = setTimeout(() => speak(josa(P.name, '을', '를') + ' 그려 볼까?'), 400);
  return { el, cleanup: () => { clearTimeout(timer); tr.destroy(); } };
}

// ============ 그리기 (자유 / 밑그림 위에) ============
const STAMPS = ['🦖', '🚗', '🐘', '🚒', '🦁', '🚀', '🐢', '🚜', '🦕', '🐯', '✈️', '🐧'];
const COLS = ['rainbow', '#ff6b6b', '#ffa94d', '#fcc419', '#51cf66', '#339af0', '#9775fa', '#343a40'];
// 🌈로 채울 때 차례로 쓰는 밝은 색
const FILLS = ['#ff8787', '#ffc078', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc', '#f783ac', '#63e6be'];
const UNDO_MAX = 10, UNDO_BYTES = 60e6; // 되돌리기: 최대 10번, 메모리 60MB까지

export function drawScreen(go, arg = {}) {
  let col = 'rainbow', size = 16, mode = arg.fill ? 'fill' : 'brush', hue = 0, down = false, last = null, pid = null;
  let fillN = 0, undos = [], pre = null, box = null;
  // 밑그림 정하기
  let bg = null;
  if (arg.pic && PIC_BY[arg.pic]) bg = { kind: 'pic', p: PIC_BY[arg.pic] };
  else if (arg.char) { const c = chars().find((x) => x.id === arg.char); if (c && c.img) bg = { kind: 'img', img: c.img }; }
  else if (arg.photo && photo) bg = { kind: 'img', img: photo.img };
  let lineMode = false, praised = false;

  const bgc = h('canvas', { class: 'dcanvas bgc' });
  const cv = h('canvas', { class: 'dcanvas' });
  const wrap = h('div', { class: 'dwrap' }, bgc, cv);
  const ctx = cv.getContext('2d'), bctx = bgc.getContext('2d');

  const colBtns = COLS.map((c) => h('button', {
    class: 'cbtn' + (c === col ? ' on' : ''), style: c === 'rainbow' ? '' : `background:${c}`,
    onclick: () => { sfx('tap'); col = c; if (mode === 'stamp') mode = 'brush'; sync(); },
  }, c === 'rainbow' ? '🌈' : ''));
  const sizeBtn = h('button', { class: 'btn sq', onclick: () => { size = size === 16 ? 34 : 16; if (mode !== 'brush') mode = 'brush'; sync(); } }, '●');
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
  const bar = h('div', { class: 'bar dbar' }, colBtns, sizeBtn, fillBtn, stampBtn, lineBtn, doneBtn, undoBtn, clr);
  const sync = () => {
    colBtns.forEach((b, i) => b.classList.toggle('on', COLS[i] === col && mode !== 'stamp'));
    sizeBtn.style.fontSize = size === 16 ? '20px' : '40px'; stampBtn.classList.toggle('on', mode === 'stamp');
    fillBtn.classList.toggle('on', mode === 'fill');
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

  const fit = () => {
    const w = wrap.clientWidth, hh = wrap.clientHeight;
    if (!w || !hh) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    const keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height;
    if (cv.width) keep.getContext('2d').drawImage(cv, 0, 0);
    for (const c of [cv, bgc]) { c.width = Math.round(w * d); c.height = Math.round(hh * d); c.style.width = w + 'px'; c.style.height = hh + 'px'; }
    if (keep.width) ctx.drawImage(keep, 0, 0);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    W = w; H = hh; paintBg();
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

  function doFill(p) {
    const k = dpr();
    const c = col === 'rainbow' ? FILLS[fillN++ % FILLS.length] : col;
    const useBg = !!bg && (bg.kind === 'pic' || lineMode);
    const u = floodFill(ctx, bctx, p.x * k, p.y * k, hexRgb(c), useBg);
    if (u) { pushUndo(u); sfx('fill'); } else sfx('boing');
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const style = () => { ctx.lineCap = ctx.lineJoin = 'round'; ctx.lineWidth = size; ctx.strokeStyle = col === 'rainbow' ? `hsl(${hue} 90% 55%)` : col; };

  cv.addEventListener('pointerdown', (e) => {
    if (down) return;
    e.preventDefault(); last = pos(e);
    if (mode === 'fill') { doFill(last); return; }
    down = true; pid = e.pointerId; cv.setPointerCapture(pid);
    pre = ctx.getImageData(0, 0, cv.width, cv.height); box = null;
    if (mode === 'stamp') {
      grow(last, 60);
      // 도장: 이모지 + 내 캐릭터 중에서 무작위
      const mine = chars().filter((c) => c.img);
      const n = STAMPS.length + mine.length, r = Math.floor(Math.random() * n);
      if (r >= STAMPS.length) {
        const im = mine[r - STAMPS.length].img, s = 110 / Math.max(im.naturalWidth, im.naturalHeight);
        ctx.drawImage(im, last.x - (im.naturalWidth * s) / 2, last.y - (im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s);
      } else {
        ctx.font = '90px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(STAMPS[r], last.x, last.y);
      }
      sfx('tap'); endStroke(); return;
    }
    grow(last, size); style(); ctx.beginPath(); ctx.arc(last.x, last.y, size / 2, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== pid || mode === 'stamp') return;
    const p = pos(e); hue = (hue + 3) % 360; style(); grow(p, size);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p;
  });
  const up = (e) => { if (e.pointerId === pid) { down = false; pid = null; if (mode !== 'stamp') endStroke(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  sync();
  return { el, cleanup: () => ro.disconnect() };
}
