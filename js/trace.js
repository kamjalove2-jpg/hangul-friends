// 따라쓰기 엔진: 체크포인트를 손가락이 지나가면 칠해지는 방식 (획 순서는 강제하지 않음)
const STEP = 4;
const COLORS = ['#ff6b6b', '#ffa94d', '#fcc419', '#51cf66', '#339af0', '#9775fa'];

export function makePath(poly) {
  const cum = [0];
  for (let i = 1; i < poly.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]));
  }
  const len = cum[cum.length - 1] || 1;
  return {
    poly, len,
    at(d) {
      d = Math.max(0, Math.min(len, d));
      let i = 1;
      while (i < cum.length - 1 && cum[i] < d) i++;
      const seg = cum[i] - cum[i - 1] || 1;
      const t = (d - cum[i - 1]) / seg;
      return { x: poly[i - 1][0] + (poly[i][0] - poly[i - 1][0]) * t, y: poly[i - 1][1] + (poly[i][1] - poly[i - 1][1]) * t };
    },
  };
}

export class Tracer {
  constructor(canvas, strokes, o = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = o; this.R = o.radius || 12; this.need = o.need || 0.8; this.gw = o.width || 14;
    this.down = false; this.pid = null; this.last = null;
    this.frame = this.frame.bind(this);
    this.on = {
      down: (e) => this.pdown(e), move: (e) => this.pmove(e), up: (e) => this.pup(e),
    };
    canvas.addEventListener('pointerdown', this.on.down);
    canvas.addEventListener('pointermove', this.on.move);
    canvas.addEventListener('pointerup', this.on.up);
    canvas.addEventListener('pointercancel', this.on.up);
    this.load(strokes);
  }

  load(strokes) {
    this.strokes = strokes.map((poly) => {
      const path = makePath(poly);
      const n = Math.max(3, Math.ceil(path.len / STEP));
      const cps = [];
      for (let i = 0; i <= n; i++) { const p = path.at((path.len * i) / n); cps.push({ x: p.x, y: p.y, hit: false }); }
      return { path, cps, done: false, hits: 0 };
    });
    this.finished = false; this.trails = []; this.lastTouch = performance.now() - 2000;
  }

  reset() { this.load(this.strokes.map((s) => s.path.poly)); }

  start() { this.raf = requestAnimationFrame(this.frame); }
  destroy() {
    cancelAnimationFrame(this.raf);
    this.c.removeEventListener('pointerdown', this.on.down);
    this.c.removeEventListener('pointermove', this.on.move);
    this.c.removeEventListener('pointerup', this.on.up);
    this.c.removeEventListener('pointercancel', this.on.up);
    if (this.ro) this.ro.disconnect();
  }

  pos(e) {
    const r = this.c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 };
  }

  pdown(e) {
    if (this.down || this.finished) return;
    e.preventDefault();
    this.down = true; this.pid = e.pointerId;
    try { this.c.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    const p = this.pos(e);
    this.last = p;
    this.trails.push({ hue: (this.trails.length * 55) % 360, pts: [p] });
    this.hit(p.x, p.y);
  }

  pmove(e) {
    if (!this.down || e.pointerId !== this.pid) return;
    e.preventDefault();
    const p = this.pos(e), a = this.last;
    const d = Math.hypot(p.x - a.x, p.y - a.y);
    const n = Math.max(1, Math.ceil(d / 1.5));
    for (let i = 1; i <= n; i++) this.hit(a.x + ((p.x - a.x) * i) / n, a.y + ((p.y - a.y) * i) / n);
    this.last = p;
    this.trails[this.trails.length - 1].pts.push(p);
  }

  pup(e) {
    if (e.pointerId !== this.pid) return;
    this.down = false; this.pid = null; this.lastTouch = performance.now();
  }

  hit(x, y) {
    let any = false;
    for (const s of this.strokes) {
      if (s.done) continue;
      for (const p of s.cps) {
        if (!p.hit && (p.x - x) ** 2 + (p.y - y) ** 2 <= this.R ** 2) { p.hit = true; s.hits++; any = true; }
      }
      if (s.hits / s.cps.length >= this.need) {
        s.done = true; s.cps.forEach((p) => { p.hit = true; });
        if (this.o.onStroke) this.o.onStroke(s);
      }
    }
    if (any && !this.finished && this.strokes.every((s) => s.done)) {
      this.finished = true;
      setTimeout(() => this.o.onDone && this.o.onDone(), 450);
    }
  }

  frame(t) {
    this.raf = requestAnimationFrame(this.frame);
    const cv = this.c, ctx = this.ctx;
    if (!cv.width) return;
    const k = cv.width / 100;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 100, 100);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = (s) => { ctx.beginPath(); s.path.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };

    // 안내선
    ctx.lineWidth = this.gw; ctx.strokeStyle = '#e9ecef';
    this.strokes.forEach((s) => { trace(s); ctx.stroke(); });
    // 칠해진 부분
    this.strokes.forEach((s, i) => {
      const col = COLORS[i % COLORS.length];
      if (s.done) { ctx.strokeStyle = col; ctx.lineWidth = this.gw; trace(s); ctx.stroke(); } else {
        ctx.fillStyle = col;
        s.cps.forEach((p) => { if (p.hit) { ctx.beginPath(); ctx.arc(p.x, p.y, this.gw / 2, 0, 7); ctx.fill(); } });
      }
    });
    // 손가락 자국 (무지개)
    ctx.lineWidth = 2.6; ctx.globalAlpha = this.finished ? 0.15 : 0.5;
    this.trails.forEach((tr) => {
      ctx.strokeStyle = `hsl(${tr.hue} 90% 55%)`; ctx.beginPath();
      tr.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    });
    ctx.globalAlpha = 1;

    if (this.finished) return;
    // 시작점 번호
    const todo = this.strokes.map((s, i) => [s, i]).filter(([s]) => !s.done);
    todo.forEach(([s, i]) => {
      const p = s.path.poly[0];
      ctx.fillStyle = '#fa5252'; ctx.beginPath(); ctx.arc(p[0], p[1], 4.6, 0, 7); ctx.fill();
      if (this.strokes.length > 1) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 6.4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p[0], p[1] + 0.4);
      } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, 7); ctx.fill(); }
    });
    // 안내 손가락
    if (!this.down && performance.now() - this.lastTouch > 2500 && todo.length) {
      const s = todo[0][0];
      const ph = Math.min(1, ((t % 2800) / 2000));
      const e = ph < 0.5 ? 2 * ph * ph : 1 - 2 * (1 - ph) ** 2;
      const p = s.path.at(s.path.len * e);
      ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('👆', p.x, p.y - 1);
    }
  }
}

export function mountTracer(stage, strokes, opts) {
  const cv = document.createElement('canvas');
  cv.className = 'tcanvas';
  stage.append(cv);
  const tr = new Tracer(cv, strokes, opts);
  const fit = () => {
    const s = Math.floor(Math.min(stage.clientWidth, stage.clientHeight));
    if (s < 10) return;
    const d = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.width = cv.style.height = s + 'px';
    cv.width = cv.height = Math.round(s * d);
  };
  tr.ro = new ResizeObserver(fit);
  tr.ro.observe(stage);
  fit();
  tr.start();
  return tr;
}
