// 숫자 공부: 숫자 따라쓰기 · 세어 보기 · (풍선은 games.js의 숫자 모드)
import { store, save, addTrace, addStars } from './store.js';
import { sfx, speak } from './audio.js';
import { h, shuffle, topbar, confetti, modal, toast, refreshStars, cheer, starRow } from './ui.js';
import { mountTracer, LEVELS } from './trace.js';
import { chars, charEl } from './chars.js';

// ---- 숫자 0~9 획 (0~100 좌표의 중심선) ----
const ell = (cx, cy, rx, ry, a0 = -90, a1 = 270, n = 28) => {
  const p = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    p.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return p;
};
const DIGIT = {
  0: [ell(50, 50, 24, 36)],
  1: [[[40, 24], [53, 14], [53, 86]]],
  2: [[[30, 30], [38, 18], [50, 14], [62, 18], [69, 30], [65, 44], [30, 86], [72, 86]]],
  3: [[[31, 22], [44, 14], [60, 16], [68, 28], [62, 42], [48, 48], [64, 54], [70, 68], [62, 82], [46, 86], [30, 78]]],
  4: [[[58, 14], [26, 64], [76, 64]], [[60, 38], [60, 86]]],
  5: [[[36, 16], [33, 46], [50, 42], [64, 48], [70, 62], [64, 78], [48, 86], [32, 80]], [[36, 16], [68, 16]]],
  6: [[[64, 18], [50, 14], [36, 24], [30, 44], [30, 66], [38, 82], [52, 86], [66, 78], [70, 64], [64, 52], [50, 48], [36, 54], [30, 64]]],
  7: [[[28, 16], [72, 16], [44, 86]]],
  8: [ell(50, 32, 17, 17), ell(50, 66, 21, 20)],
  9: [ell(48, 34, 19, 19, 0, -360), [[67, 34], [62, 86]]],
};
const place = (strokes, [bx, by, bw, bh]) => strokes.map((s) => s.map(([x, y]) => [bx + (x / 100) * bw, by + (y / 100) * bh]));

export function numStrokes(n) {
  const ds = String(n).split('');
  if (ds.length === 1) return DIGIT[n];
  return [...place(DIGIT[ds[0]], [2, 8, 50, 84]), ...place(DIGIT[ds[1]], [48, 8, 50, 84])];
}

// ---- 읽기 ----
const NATIVE = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉', '열',
  '열하나', '열둘', '열셋', '열넷', '열다섯', '열여섯', '열일곱', '열여덟', '열아홉', '스물'];
const SINO_D = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
const sino = (n) => (n < 10 ? SINO_D[n] : (n >= 20 ? SINO_D[Math.floor(n / 10)] : '') + '십' + SINO_D[n % 10]);
export const NATIVE_WORDS = NATIVE.slice(1, 11).concat(['스물']);
export const SINO_WORDS = SINO_D.slice(1).concat(['십']);

// 숫자 읽기 (부모 설정: native 하나·둘 / sino 일·이 / both "삼! 셋!")
export function readNum(n) {
  const m = store.settings.numRead || 'native';
  if (m === 'sino') return sino(n);
  if (m === 'both') return `${sino(n)}! ${NATIVE[n]}`;
  return NATIVE[n];
}
// 물건을 셀 때 ("하나, 둘…"): 일·이 설정일 때만 일·이로
const countWord = (n) => (store.settings.numRead === 'sino' ? sino(n) : NATIVE[n]);

export const numMax = () => [5, 10, 20].includes(store.settings.numMax) ? store.settings.numMax : 10;

// 숫자 스티커 그림
const NUM_EMOJI = ['🐘', '🦆', '🚗', '🐟', '🍎', '🦋', '🎈', '⭐', '🐞', '🦖', '🚀', '🐢', '🍓', '🐠', '🚌', '🌸', '🐧', '🍌', '🐝', '🍩'];
export const NUMS = Array.from({ length: 20 }, (_, i) => {
  const n = i + 1;
  return { id: 'n' + n, n, ch: String(n), emoji: NUM_EMOJI[i] };
});
export const NUM_BY = Object.fromEntries(NUMS.map((x) => [x.n, x]));
export const numsInRange = () => NUMS.filter((x) => x.n <= numMax());

// 개수만큼 그림 늘어놓기 (10개 넘으면 "×13")
export const many = (emoji, n) => (n <= 10 ? emoji.repeat(n) : `${emoji}×${n}`);

// ============ 숫자 놀이 고르기 ============
export function numHubScreen(go) {
  const card = (emoji, label, bg, fn) => h('button', { class: 'mbtn', style: `background:${bg}`, onclick: () => { sfx('tap'); fn(); } },
    h('span', { class: 'me' }, emoji), h('span', { class: 'ml' }, label));
  const nextN = () => (numsInRange().find((x) => !store.stickers[x.id]) || NUMS[0]).n;
  const el = h('div', { class: 'screen' }, topbar(go, { title: '🔢 숫자' }),
    h('div', { class: 'menu numhub' },
      card('✏️', '숫자 따라쓰기', '#ffd8a8', () => go('numtrace', { n: nextN() })),
      card('🖐️', '세어 보기', '#d3f9d8', () => go('count')),
      card('🎈', '숫자 풍선', '#ffc9c9', () => go('balloon', { nums: true }))));
  setTimeout(() => { if (el.isConnected) speak('숫자 놀이 하자!'); }, 300);
  return { el, cleanup: () => {} };
}

function numPicker(go) {
  const m = modal(h('div', { class: 'picker' },
    h('div', { class: 'pkt' }, '🔢 숫자 고르기'),
    h('div', { class: 'pickgrid' }, numsInRange().map((x) => h('button', {
      class: 'pickc' + (store.stickers[x.id] ? ' got' : ''), onclick: () => { sfx('tap'); m.close(); go('numtrace', { n: x.n }); },
    }, h('span', { class: 'pke numch' }, x.ch), h('span', { class: 'pkn' }, store.stickers[x.id] ? x.emoji : ''))))));
}

// ============ 숫자 따라쓰기 ============
export function numTraceScreen(go, { n = 1 } = {}) {
  const N = NUM_BY[n] || NUMS[0];
  const next = () => { const r = numsInRange(); return r[(r.findIndex((x) => x.n === N.n) + 1) % r.length].n; };
  const stage = h('div', { class: 'tstage' });
  let tr, timer;
  const bar = h('div', { class: 'bar' },
    h('button', { class: 'btn round', onclick: () => speak(readNum(N.n)) }, '🔊'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); tr.reset(); } }, '🔄'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); go('numtrace', { n: next() }); } }, '⏭️'));
  const el = h('div', { class: 'screen lay' },
    topbar(go, { title: '', right: h('button', { class: 'btn sq', onclick: () => numPicker(go) }, '🔢') }), stage, bar);
  const lv = LEVELS[store.settings.level] || LEVELS.easy;
  tr = mountTracer(stage, numStrokes(N.n), {
    ...lv,
    onStroke: () => sfx('stroke'),
    onRetry: () => { sfx('soft'); speak('천천히 한 번 더 써 볼까?'); toast('한 번 더! 💪'); },
    onDone: ({ stars }) => {
      sfx('win'); confetti();
      const gold = ['hard', 'expert'].includes(store.settings.level) && stars === 3;
      const isNew = addTrace(N.id, gold);
      addStars(stars); refreshStars();
      timer = setTimeout(() => speak(readNum(N.n) + '!'), 800);
      const m = modal(h('div', { class: 'reward' },
        h('div', { class: 'got' }, gold ? '✨ 반짝 스티커! ✨' : isNew ? '새 스티커!' : '참 잘했어요!'),
        starRow(stars),
        h('div', { class: 'row' }, h('div', { class: 'bigemo numbig bounce' + (gold ? ' goldemo' : '') }, N.ch), cheer()),
        h('div', { class: 'manyemo' }, many(N.emoji, N.n)),
        h('div', { class: 'cap' }, `${N.ch}  ${readNum(N.n)}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn round', onclick: () => { m.close(); go('numtrace', { n: N.n }); } }, '🔁'),
          h('button', { class: 'btn round', onclick: () => { m.close(); go('book', { tab: 'num' }); } }, '⭐'),
          h('button', { class: 'btn round primary', onclick: () => { m.close(); go('numtrace', { n: next() }); } }, '➡️'))),
      { dismiss: false });
    },
  });
  timer = setTimeout(() => speak(readNum(N.n)), 400);
  return { el, cleanup: () => { clearTimeout(timer); tr.destroy(); } };
}

// ============ 세어 보기 ============
const THINGS = ['🦖', '🚗', '✈️', '🐧', '🍎', '⭐', '🎈', '🐟', '🚒', '🦋', '🍓', '🐢'];

export function countScreen(go) {
  const ROUNDS = 5;
  let round = 0, done = 0, N = 0, counted = 0, locked = false, timers = [], alive = true, cols = 1, rows = 1;
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const dots = h('div', { class: 'dots' });
  const stage = h('div', { class: 'cstage' });
  const opts = h('div', { class: 'copts' });
  const hear = h('button', { class: 'btn round', onclick: () => (counted >= N ? speak('몇 개일까?') : speak('세어 보자!')) }, '🔊');
  const el = h('div', { class: 'screen' }, topbar(go, { title: '', right: h('div', { class: 'row' }, dots, hear) }), stage, opts);
  const drawDots = () => { dots.innerHTML = ''; for (let i = 0; i < ROUNDS; i++) dots.append(h('span', { class: 'dot' + (i < done ? ' on' : '') })); };

  function newRound() {
    if (round >= ROUNDS) return finish();
    round++; locked = false; counted = 0; stage.innerHTML = ''; opts.innerHTML = ''; drawDots();
    const max = Math.min(numMax(), 10);
    N = 1 + Math.floor(Math.random() * max);
    // 내 캐릭터가 있으면 가끔 캐릭터로 세기
    const mine = chars().filter((c) => c.img);
    const useChar = mine.length && Math.random() < 0.4 ? mine[Math.floor(Math.random() * mine.length)] : null;
    const thing = THINGS[Math.floor(Math.random() * THINGS.length)];
    // 칸에 나눠 겹치지 않게 놓기
    cols = Math.ceil(Math.sqrt(N * 1.6)); rows = Math.ceil(N / cols);
    sizeItems();
    const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, N);
    cells.forEach((c) => {
      const x = ((c % cols) + 0.5 + (Math.random() - 0.5) * 0.3) / cols * 100;
      const y = (Math.floor(c / cols) + 0.5 + (Math.random() - 0.5) * 0.3) / rows * 100;
      const it = h('button', { class: 'citem', style: `left:${x}%;top:${y}%` },
        useChar ? charEl(useChar, 'citimg') : thing);
      it.addEventListener('click', () => countOne(it));
      stage.append(it);
    });
    later(() => speak('세어 보자!'), 400);
  }

  // 화면 크기에 맞춰 그림 크기 정하기 (칸보다 작게 해서 겹치지 않게)
  function sizeItems() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    if (!w || !hh) return;
    const cell = Math.min(w / cols, hh / rows);
    stage.style.setProperty('--s', Math.max(30, Math.min(140, cell * 0.55)) + 'px');
  }
  const ro = new ResizeObserver(sizeItems); ro.observe(stage);

  function countOne(it) {
    if (it.classList.contains('done') || counted >= N) return;
    counted++;
    it.classList.add('done');
    it.append(h('span', { class: 'cbadge' }, String(counted)));
    sfx('tap'); speak(countWord(counted), 0.9);
    if (counted >= N) later(ask, 900);
  }

  function ask() {
    speak('몇 개일까?');
    const max = Math.min(numMax(), 10);
    const others = shuffle(Array.from({ length: max }, (_, i) => i + 1).filter((v) => v !== N)).slice(0, 2);
    shuffle([N, ...others]).forEach((v) => {
      const b = h('button', { class: 'copt', onclick: () => choose(v, b) }, String(v));
      opts.append(b);
    });
  }

  function choose(v, b) {
    if (locked) return;
    if (v === N) {
      locked = true; done++; drawDots();
      sfx('win'); b.classList.add('right');
      const r = b.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top + r.height / 2, 20);
      addStars(1); refreshStars();
      const t0 = Date.now();
      later(async () => {
        await speak(`정답! ${readNum(N)}!`);
        if (alive) later(newRound, Math.max(400, 2200 - (Date.now() - t0)));
      }, 800);
    } else {
      sfx('boing'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      speak('다시 세어 볼까?');
      // 다시 셀 수 있게 표시 지우기
      counted = 0;
      stage.querySelectorAll('.citem').forEach((it) => { it.classList.remove('done'); const s = it.querySelector('.cbadge'); if (s) s.remove(); });
      opts.innerHTML = '';
    }
  }

  function finish() {
    sfx('win'); confetti(innerWidth / 2, innerHeight / 3, 50);
    addStars(2); refreshStars(); save();
    later(() => speak('우와! 모두 맞췄어요! 최고예요!'), 800);
    const m = modal(h('div', { class: 'reward' },
      h('div', { class: 'row' }, h('div', { class: 'bigemo' }, '🖐️🏆'), cheer()), h('div', { class: 'cap' }, '별 +2 ⭐⭐'),
      h('div', { class: 'row' },
        h('button', { class: 'btn round', onclick: () => { m.close(); round = 0; done = 0; newRound(); } }, '🔁'),
        h('button', { class: 'btn round', onclick: () => { m.close(); go('numbers'); } }, '🔢'))), { dismiss: false });
  }

  newRound();
  return { el, cleanup: () => { alive = false; timers.forEach(clearTimeout); ro.disconnect(); } };
}
