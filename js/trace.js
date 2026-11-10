// 따라쓰기 엔진: 체크포인트를 손가락이 지나가면 칠해지는 방식
// 난이도에 따라 허용 폭, 채움 비율, 획 순서·방향, 선 밖 이탈, 안내선 표시 방식이 달라진다.
const STEP = 4;
const COLORS = ['#ff6b6b', '#ffa94d', '#fcc419', '#51cf66', '#339af0', '#9775fa'];
const DIR_WIN = 4; // 방향 확인: 지금까지 칠한 곳에서 이만큼 앞의 체크포인트까지만 인정

// 난이도 설정 (좌표는 0~100)
// off: 선 밖 판정 거리, offMax: 이보다 많이 벗어나면 "한 번 더", s3/s2: 별 3개·2개 기준 이탈 비율
export const LEVELS = {
  easy: { radius: 17, need: 0.7, width: 15, order: false, dir: false, guide: 'solid', off: 16, offMax: 0, s3: 0.35, s2: 0.6 },
  normal: { radius: 12, need: 0.82, width: 13, order: false, dir: false, guide: 'solid', off: 13, offMax: 0, s3: 0.2, s2: 0.4 },
  hard: { radius: 9, need: 0.9, width: 11, order: true, dir: true, guide: 'fade', off: 10, offMax: 0.3, s3: 0.1, s2: 0.2 },
  expert: { radius: 7, need: 0.95, width: 9, order: true, dir: true, guide: 'flash', off: 8, offMax: 0.2, s3: 0.06, s2: 0.12 },
};
export const LEVEL_NAMES = [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움'], ['expert', '매우 어려움']];

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

// 점과 폴리라인 사이 최단 거리
function distPoly(x, y, poly) {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
    if (d < best) best = d;
  }
  return best;
}

export class Tracer {
  constructor(canvas, strokes, o = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.o = { ...LEVELS.easy, ...o };
    this.R = this.o.radius; this.need = this.o.need; this.gw = this.o.width;
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
      return { path, cps, done: false, hits: 0, front: -1 };
    });
    this.finished = false; this.trails = []; this.lastTouch = performance.now() - 2000;
    this.samples = 0; this.offs = 0; this.shown = performance.now(); this.pulse = 0;
  }

  reset() { this.load(this.strokes.map((s) => s.path.poly)); }

  start() { this.raf = requestAnimationFrame(this.frame); }
  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.rt);
    this.c.removeEventListener('pointerdown', this.on.down);
    this.c.removeEventListener('pointermove', this.on.move);
    this.c.removeEventListener('pointerup', this.on.up);
    this.c.removeEventListener('pointercancel', this.on.up);
    if (this.ro) this.ro.disconnect();
  }

  active() { return this.strokes.find((s) => !s.done); }

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
    // 방향 모드에서 시작점이 아닌 곳을 누르면 시작점을 반짝여 알려줌
    const a = this.active();
    if (this.o.dir && a && a.front < 0 && Math.hypot(p.x - a.cps[0].x, p.y - a.cps[0].y) > this.R * 1.4) this.pulse = performance.now();
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

  // 선 밖으로 벗어났는지 기록 (순서가 틀린 획은 칠해지지만 않을 뿐 감점하지 않음)
  track(x, y) {
    if (this.finished) return;
    const d = Math.min(...this.strokes.map((s) => distPoly(x, y, s.path.poly)));
    this.samples++;
    if (d > this.o.off) this.offs++;
  }

  hit(x, y) {
    this.track(x, y);
    let any = false;
    const act = this.active();
    for (const s of this.strokes) {
      if (s.done) continue;
      if (this.o.order && s !== act) continue;
      s.cps.forEach((p, i) => {
        if (p.hit || (p.x - x) ** 2 + (p.y - y) ** 2 > this.R ** 2) return;
        if (this.o.dir && i > s.front + DIR_WIN) return; // 거꾸로 쓰면 칠해지지 않음
        p.hit = true; s.hits++; any = true;
        if (i > s.front) s.front = i; // 조금 건너뛴 점은 봐줌
      });
      if (s.hits / s.cps.length >= this.need) {
        s.done = true; s.cps.forEach((p) => { p.hit = true; });
        if (this.o.onStroke) this.o.onStroke(s);
      }
    }
    if (any && !this.finished && this.strokes.every((s) => s.done)) this.finish();
  }

  finish() {
    this.finished = true;
    const off = this.samples ? this.offs / this.samples : 0;
    if (this.o.offMax && off > this.o.offMax) {
      // 너무 많이 벗어남: 실패음 없이 다시 해보기
      if (this.o.onRetry) this.o.onRetry(off);
      this.rt = setTimeout(() => this.reset(), 1400);
      return;
    }
    const stars = off <= this.o.s3 ? 3 : off <= this.o.s2 ? 2 : 1;
    this.rt = setTimeout(() => this.o.onDone && this.o.onDone({ stars, off }), 450);
  }

  guideAlpha(now) {
    const g = this.o.guide;
    if (g === 'fade') return this.down ? 0.35 : 0.75;
    if (g === 'flash') {
      const since = now - this.shown;
      if (since < 2000) return 1;
      if (since < 2600) return 1 - (since - 2000) / 600;
      // 오래 멈춰 있으면 살짝 다시 보여줌
      return !this.down && now - this.lastTouch > 7000 ? 0.4 : 0;
    }
    return 1;
  }

  frame(t) {
    this.raf = requestAnimationFrame(this.frame);
    const cv = this.c, ctx = this.ctx;
    if (!cv.width) return;
    const k = cv.width / 100, now = performance.now();
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, 100, 100);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const trace = (s) => { ctx.beginPath(); s.path.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };

    // 안내선
    const ga = this.finished ? 1 : this.guideAlpha(now);
    if (ga > 0) {
      ctx.globalAlpha = ga; ctx.lineWidth = this.gw; ctx.strokeStyle = '#e9ecef';
      if (this.o.guide === 'fade') { ctx.lineWidth = this.gw * 0.45; ctx.setLineDash([0.01, this.gw * 0.6]); ctx.strokeStyle = '#adb5bd'; }
      this.strokes.forEach((s) => { trace(s); ctx.stroke(); });
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
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
    // 시작점 번호 (획 순서 모드에서는 지금 쓸 획만)
    let todo = this.strokes.map((s, i) => [s, i]).filter(([s]) => !s.done);
    if (this.o.order) todo = todo.slice(0, 1);
    const pz = now - this.pulse < 1200 ? 1 + 0.5 * Math.abs(Math.sin((now - this.pulse) / 120)) : 1;
    todo.forEach(([s, i]) => {
      const p = s.path.poly[0];
      ctx.fillStyle = '#fa5252'; ctx.beginPath(); ctx.arc(p[0], p[1], 4.6 * pz, 0, 7); ctx.fill();
      if (this.strokes.length > 1) {
        ctx.fillStyle = '#fff'; ctx.font = 'bold 6.4px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), p[0], p[1] + 0.4);
      } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p[0], p[1], 1.8, 0, 7); ctx.fill(); }
    });
    // 안내 손가락 (어려울수록 늦게 나옴)
    const wait = this.o.guide === 'flash' ? 6000 : this.o.guide === 'fade' ? 4000 : 2500;
    if (!this.down && now - this.lastTouch > wait && todo.length) {
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
