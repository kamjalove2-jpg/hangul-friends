import { LETTERS, BY, compose } from './data.js';
import { store, addStars, save } from './store.js';
import { sfx, speak, sayLetter, josa } from './audio.js';
import { h, shuffle, topbar, confetti, modal, refreshStars, cheer } from './ui.js';

// ============ 풍선 터뜨리기 ============
const EASY = ['ㅣ', 'ㅡ', 'ㅇ', 'ㅏ', 'ㅗ', 'ㅜ', 'ㄱ', 'ㄴ', 'ㅁ', 'ㅅ'];
const BCOL = ['#ff6b6b', '#ffa94d', '#fcc419', '#51cf66', '#339af0', '#cc5de8'];

export function balloonScreen(go) {
  const ROUNDS = 5;
  let round = 0, done = 0, target = null, locked = false, timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); };
  const dots = h('div', { class: 'dots' });
  const stage = h('div', { class: 'bstage' });
  const hear = h('button', { class: 'btn round', onclick: () => ask() }, '🔊');
  const el = h('div', { class: 'screen' },
    topbar(go, { title: '', right: h('div', { class: 'row' }, dots, hear) }), stage);

  const drawDots = () => { dots.innerHTML = ''; for (let i = 0; i < ROUNDS; i++) dots.append(h('span', { class: 'dot' + (i < done ? ' on' : '') })); };
  const ask = () => speak(`${target.say} 어디 있을까?`);

  function newRound() {
    if (round >= ROUNDS) return finish();
    round++; locked = false; stage.innerHTML = ''; drawDots();
    const collected = LETTERS.filter((l) => store.stickers[l.id]);
    const pool = collected.length >= 5 ? LETTERS : EASY.map((i) => BY[i]);
    target = pool[Math.floor(Math.random() * pool.length)];
    const nOther = round > 2 ? 3 : 2;
    const list = shuffle([target, ...shuffle(pool.filter((l) => l !== target)).slice(0, nOther)]);
    const cols = shuffle(BCOL);
    list.forEach((l, i) => {
      const b = h('button', {
        class: 'balloon', style: `left:${((i + 0.5) / list.length) * 100}%;--c:${cols[i]};animation-delay:${-Math.random() * 3}s;margin-top:${(i % 2) * 40}px`,
        onclick: () => choose(l, b),
      }, h('span', {}, l.ch));
      stage.append(b);
    });
    later(ask, 500);
  }

  function choose(l, b) {
    if (locked) return;
    if (l === target) {
      locked = true; done++; drawDots();
      sfx('pop'); b.classList.add('pop');
      const r = b.getBoundingClientRect();
      confetti(r.left + r.width / 2, r.top + r.height / 2, 18);
      later(() => { sayLetter(target); }, 250);
      addStars(1); refreshStars();
      later(newRound, 2200);
    } else {
      sfx('boing'); b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
      speak(`이건 ${l.say}. ${josa(target.say, '을', '를')} 찾아보자!`);
    }
  }

  function finish() {
    sfx('win'); confetti(innerWidth / 2, innerHeight / 3, 50);
    addStars(2); refreshStars();
    speak('우와! 모두 맞췄어요! 최고예요!');
    const m = modal(h('div', { class: 'reward' },
      h('div', { class: 'row' }, h('div', { class: 'bigemo' }, '🎈🏆🎈'), cheer()), h('div', { class: 'cap' }, '별 +2 ⭐⭐'),
      h('div', { class: 'row' },
        h('button', { class: 'btn round', onclick: () => { m.close(); round = 0; done = 0; newRound(); } }, '🔁'),
        h('button', { class: 'btn round', onclick: () => { m.close(); go('home'); } }, '🏠'))), { dismiss: false });
  }

  newRound();
  return { el, cleanup: () => timers.forEach(clearTimeout) };
}

// ============ 글자 블록 (자음 + 모음 = 글자) ============
export function blocksScreen(go) {
  let c = null, v = null, busy = false;
  const slotC = h('div', { class: 'slot' }), slotV = h('div', { class: 'slot' });
  const result = h('div', { class: 'slot res' });
  const eq = h('div', { class: 'op' }, '＋'), eq2 = h('div', { class: 'op' }, '＝');
  const board = h('div', { class: 'bboard' }, slotC, eq, slotV, eq2, result);

  const tile = (l) => h('button', {
    class: 'tile ' + l.kind, onclick: () => pick(l),
  }, l.ch);
  const rowC = h('div', { class: 'trow' }, LETTERS.filter((l) => l.kind === 'c').map(tile));
  const rowV = h('div', { class: 'trow' }, LETTERS.filter((l) => l.kind === 'v').map(tile));
  const el = h('div', { class: 'screen' }, topbar(go, { title: '' }),
    h('div', { class: 'blocks' }, board, h('div', { class: 'tiles' }, rowC, rowV)));

  const render = () => {
    slotC.textContent = c ? c.ch : ''; slotV.textContent = v ? v.ch : '';
    slotC.classList.toggle('filled', !!c); slotV.classList.toggle('filled', !!v);
  };

  function pick(l) {
    if (busy) clear();
    sfx('tap'); sayLetter(l, false);
    if (l.kind === 'c') c = l; else v = l;
    render();
    if (c && v) merge();
  }

  function clear() { c = v = null; busy = false; result.textContent = ''; result.classList.remove('pop'); render(); }

  function merge() {
    busy = true;
    const syl = compose(c.ch, v.ch);
    setTimeout(() => {
      sfx('merge'); result.textContent = syl; result.classList.remove('pop'); void result.offsetWidth; result.classList.add('pop');
      speak(syl, 0.7); confetti(innerWidth / 2, innerHeight / 3, 16);
      addStars(1); refreshStars();
    }, 450);
  }

  return { el, cleanup: () => {} };
}
