import { LETTERS, BY, ORDER, syllableStrokes } from './data.js';
import { store, save, today, addTrace, addStars, markDay, tick, limitSeconds } from './store.js';
import { sfx, speak, sayLetter, unlock, stopVoice, preloadRecs } from './audio.js';
import { mountTracer, LEVELS } from './trace.js';
import { h, topbar, confetti, modal, gate, toast, refreshStars, cheer, starRow } from './ui.js';
import { balloonScreen, blocksScreen } from './games.js';
import { drawScreen, pictureScreen } from './draw.js';
import { loadChars } from './chars.js';
import { bookScreen, parentScreen } from './book.js';

const app = document.getElementById('app');
let cleanup = null, current = '';

export function go(name, arg) {
  if (cleanup) { try { cleanup(); } catch { /* 무시 */ } cleanup = null; }
  stopVoice();
  document.getElementById('overlay').innerHTML = '';
  app.innerHTML = '';
  const s = screens[name](go, arg);
  app.append(s.el);
  cleanup = s.cleanup; current = name;
}

const tracerOpts = () => LEVELS[store.settings.level] || LEVELS.easy;
const hardMode = () => ['hard', 'expert'].includes(store.settings.level);
const retry = () => { sfx('soft'); speak('천천히 한 번 더 써 볼까?'); toast('한 번 더! 💪'); };

function nextLetter(after) {
  const i = ORDER.indexOf(after);
  const rotated = [...ORDER.slice(i + 1), ...ORDER.slice(0, i + 1)];
  return BY[rotated.find((id) => !store.stickers[id]) || rotated[0]];
}

function todayLetter() {
  const l = ORDER.map((id) => BY[id]).find((x) => !store.stickers[x.id]);
  return l || LETTERS[Math.floor(Date.now() / 864e5) % LETTERS.length];
}

// ============ 홈 ============
function homeScreen(go) {
  const menu = [
    ['✏️', '따라쓰기', 'pick', '#ffd8a8'], ['🎈', '풍선 터뜨리기', 'balloon', '#ffc9c9'],
    ['🧩', '글자 블록', 'blocks', '#d0ebff'], ['🎨', '그리기', 'draw', '#d3f9d8'],
    ['⭐', '스티커북', 'book', '#fff3bf'], ['🏷️', '내 이름', 'name', '#e5dbff'],
  ];
  const t = todayLetter();
  const got = LETTERS.filter((l) => store.stickers[l.id]).length;
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(h('div', { class: 'day' + (store.days[today(d)] ? ' on' : '') }, h('span', {}, store.days[today(d)] ? '⭐' : '·'), h('small', {}, '일월화수목금토'[d.getDay()])));
  }
  const el = h('div', { class: 'screen home' },
    h('div', { class: 'top' },
      h('div', { class: 'chip' }, '⭐ ', h('b', { class: 'starcnt' }, String(store.stars))),
      h('div', { class: 'ttl logo' }, '한글 친구들'),
      h('button', { class: 'btn sq ghost', onclick: () => gate(() => go('parent')) }, '⚙️')),
    h('button', { class: 'today', onclick: () => { sfx('tap'); go('trace', { id: t.id }); } },
      h('div', { class: 'tl' }, '오늘의 글자'), h('div', { class: 'tg' }, t.ch),
      h('div', { class: 'te' }, store.stickers[t.id] ? t.emoji : '❓'), cheer('homechar'), h('div', { class: 'tgo' }, '▶')),
    h('div', { class: 'menu' }, menu.map(([e, label, to, bg]) => h('button', {
      class: 'mbtn', style: `background:${bg}`, onclick: () => { sfx('tap'); go(to); },
    }, h('span', { class: 'me' }, e), h('span', { class: 'ml' }, label)))),
    h('div', { class: 'foot' }, h('div', { class: 'stamps' }, days), h('div', { class: 'prog' }, `스티커 ${got}/${LETTERS.length}`)));
  return { el, cleanup: () => {} };
}

// ============ 글자 고르기 ============
function pickScreen(go) {
  let tab = 'c';
  const grid = h('div', { class: 'pgrid scroll' });
  const t1 = h('button', { class: 'tab', onclick: () => { tab = 'c'; render(); } }, 'ㄱㄴㄷ');
  const t2 = h('button', { class: 'tab', onclick: () => { tab = 'v'; render(); } }, 'ㅏㅓㅗ');
  function render() {
    t1.classList.toggle('on', tab === 'c'); t2.classList.toggle('on', tab === 'v');
    grid.innerHTML = '';
    LETTERS.filter((l) => l.kind === tab).forEach((l) => {
      const got = store.stickers[l.id];
      grid.append(h('button', { class: 'pcard' + (got ? ' got' : ''), onclick: () => { sfx('tap'); go('trace', { id: l.id }); } },
        h('span', { class: 'pg' }, l.ch), h('span', { class: 'pe' }, got ? l.emoji : '')));
    });
  }
  render();
  const el = h('div', { class: 'screen' }, topbar(go, { title: '', right: h('div', { class: 'row' }, t1, t2) }), grid);
  return { el, cleanup: () => {} };
}

// ============ 글자 따라쓰기 ============
function traceScreen(go, { id }) {
  const L = BY[id];
  const stage = h('div', { class: 'tstage' });
  let tr, timer;
  const again = () => { sfx('tap'); tr.reset(); };
  const bar = h('div', { class: 'bar' },
    h('button', { class: 'btn round', onclick: () => sayLetter(L) }, '🔊'),
    h('button', { class: 'btn round', onclick: again }, '🔄'),
    h('button', { class: 'btn round', onclick: () => { sfx('tap'); go('trace', { id: nextLetter(id).id }); } }, '⏭️'));
  const el = h('div', { class: 'screen lay' },
    topbar(go, { title: '', right: h('button', { class: 'btn sq', onclick: () => go('pick') }, '🔠') }), stage, bar);
  tr = mountTracer(stage, L.strokes, {
    ...tracerOpts(),
    onStroke: () => sfx('stroke'),
    onRetry: retry,
    onDone: ({ stars }) => {
      sfx('win'); confetti();
      const gold = hardMode() && stars === 3; // 어려움 이상에서 별 3개 = 반짝 스티커
      const isNew = addTrace(id, gold);
      addStars(stars); refreshStars();
      timer = setTimeout(() => sayLetter(L), 800); // 축하음이 끝난 뒤 말하기
      const m = modal(h('div', { class: 'reward' },
        h('div', { class: 'got' }, gold ? '✨ 반짝 스티커! ✨' : isNew ? '새 스티커!' : '참 잘했어요!'),
        starRow(stars),
        h('div', { class: 'row' }, h('div', { class: 'bigemo bounce' + (gold ? ' goldemo' : '') }, L.emoji), cheer()),
        h('div', { class: 'cap' }, `${L.ch}  ${L.word}`),
        h('div', { class: 'row' },
          h('button', { class: 'btn round', onclick: () => { m.close(); go('trace', { id }); } }, '🔁'),
          h('button', { class: 'btn round', onclick: () => { m.close(); go('book'); } }, '⭐'),
          h('button', { class: 'btn round primary', onclick: () => { m.close(); go('trace', { id: nextLetter(id).id }); } }, '➡️'))),
      { dismiss: false });
    },
  });
  timer = setTimeout(() => sayLetter(L), 400);
  return { el, cleanup: () => { clearTimeout(timer); tr.destroy(); } };
}

// ============ 내 이름 쓰기 ============
function nameScreen(go) {
  const stage = h('div', { class: 'tstage' });
  const chips = h('div', { class: 'row namechips' });
  const el = h('div', { class: 'screen' },
    topbar(go, { title: '', right: h('button', { class: 'btn sq', onclick: () => askName() }, '✏️') }), chips, stage);
  let tr, idx = 0, syls = [], timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function askName() {
    const inp = h('input', { class: 'inp big', value: store.name, maxlength: '6', placeholder: '이름' });
    const m = modal(h('div', { class: 'gate' }, h('div', { class: 'gq' }, '이름을 적어주세요 (어른이 입력)'), inp,
      h('button', { class: 'btn primary', onclick: () => { store.name = inp.value.trim(); save(); m.close(); start(); } }, '확인')), { dismiss: false });
    setTimeout(() => inp.focus(), 100);
  }

  function start() {
    syls = [...(store.name || '')].filter((c) => syllableStrokes(c));
    if (store.name && syls.length < [...store.name].length) toast('쓸 수 없는 글자는 건너뛰었어요');
    idx = 0; chips.innerHTML = '';
    if (!syls.length) { askName(); return; }
    syls.forEach((c, i) => chips.append(h('span', { class: 'nchip', id: 'nc' + i }, c)));
    load();
  }

  function load() {
    chips.querySelectorAll('.nchip').forEach((c, i) => { c.classList.toggle('cur', i === idx); c.classList.toggle('ok', i < idx); });
    if (tr) tr.destroy();
    stage.innerHTML = '';
    const o = tracerOpts();
    tr = mountTracer(stage, syllableStrokes(syls[idx]), {
      ...o, radius: Math.max(7, o.radius * 0.8), width: o.width * 0.8, off: Math.max(8, o.off * 0.8),
      onStroke: () => sfx('stroke'),
      onRetry: retry,
      onDone: () => {
        sfx('win'); confetti(innerWidth / 2, innerHeight / 2, 20);
        const syl = syls[idx]; later(() => speak(syl, 0.7), 600);
        idx++;
        if (idx < syls.length) later(load, 1300); else later(finish, 1300);
      },
    });
  }

  function finish() {
    addTrace('name'); addStars(3); refreshStars(); sfx('win'); confetti(innerWidth / 2, innerHeight / 3, 50);
    later(() => speak(`${store.name}! 이름을 다 썼어요! 멋져요!`), 800);
    chips.querySelectorAll('.nchip').forEach((c) => { c.classList.remove('cur'); c.classList.add('ok'); });
    const m = modal(h('div', { class: 'reward' }, h('div', { class: 'got' }, '이름 스티커!'),
      h('div', { class: 'row' }, h('div', { class: 'bigemo bounce' }, '🏅'), cheer()), h('div', { class: 'cap' }, store.name),
      h('div', { class: 'row' },
        h('button', { class: 'btn round', onclick: () => { m.close(); start(); } }, '🔁'),
        h('button', { class: 'btn round', onclick: () => { m.close(); go('book'); } }, '⭐'),
        h('button', { class: 'btn round', onclick: () => { m.close(); go('home'); } }, '🏠'))), { dismiss: false });
  }

  if (store.name) start(); else askName();
  return { el, cleanup: () => { timers.forEach(clearTimeout); if (tr) tr.destroy(); } };
}

const screens = {
  home: homeScreen, pick: pickScreen, trace: traceScreen, name: nameScreen,
  balloon: balloonScreen, blocks: blocksScreen, draw: drawScreen, picture: pictureScreen, book: bookScreen, parent: parentScreen,
};

// ============ 사용 시간 관리 ============
let resting = false;
function showRest() {
  if (resting) return;
  resting = true; stopVoice();
  speak('오늘은 많이 놀았어요. 이제 쉬는 시간이에요. 안녕!');
  modal(h('div', { class: 'reward rest' },
    h('div', { class: 'bigemo' }, '🦁💤'), h('div', { class: 'cap' }, '쉬는 시간이에요~'),
    h('button', { class: 'btn small ghost', onclick: () => gate(() => {
      store.bonus[today()] = (store.bonus[today()] || 0) + 10; save(); resting = false;
      document.getElementById('overlay').innerHTML = ''; toast('10분 더 놀 수 있어요');
    }) }, '어른')), { dismiss: false, cls: 'restbox' });
}

let ticks = 0;
setInterval(() => {
  if (document.hidden || current === 'parent') return;
  tick(1);
  if (++ticks % 10 === 0) save();
  const used = store.play[today()] || 0, lim = limitSeconds();
  if (used >= lim) showRest();
  else if (lim - used === 60) toast('조금 있으면 쉬는 시간이에요 🌙', 4000);
}, 1000);

// ============ 시작 ============
document.addEventListener('pointerdown', unlock, { passive: true });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (!e.target.closest('.scroll, .modal')) e.preventDefault(); }, { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

markDay();
preloadRecs();
loadChars().then(() => { if (current === 'home') go('home'); });
go('home');
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.__go = go; window.__store = store; // 디버깅용
