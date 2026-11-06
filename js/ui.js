import { sfx } from './audio.js';
import { store } from './store.js';

export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(c));
  }
  return e;
}

export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function topbar(go, { title = '', right = null } = {}) {
  return h('div', { class: 'top' },
    h('button', { class: 'btn sq', onclick: () => { sfx('tap'); go('home'); } }, '🏠'),
    h('div', { class: 'ttl' }, title),
    right || h('div', { class: 'chip' }, '⭐ ', h('b', { class: 'starcnt' }, String(store.stars))));
}

export function refreshStars() {
  document.querySelectorAll('.starcnt').forEach((e) => { e.textContent = String(store.stars); });
}

const EMO = ['⭐', '🎉', '✨', '🌟', '💛', '🎈'];
export function confetti(x = innerWidth / 2, y = innerHeight / 2, n = 28) {
  for (let i = 0; i < n; i++) {
    const s = h('span', { class: 'conf' }, EMO[i % EMO.length]);
    const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
    s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 80}px;font-size:${18 + Math.random() * 22}px`;
    document.body.append(s);
    setTimeout(() => s.remove(), 1500);
  }
}

export function toast(msg, ms = 2200) {
  const t = h('div', { class: 'toast' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

const overlay = () => document.getElementById('overlay');

export function modal(content, { dismiss = true, cls = '' } = {}) {
  const bg = h('div', { class: 'modal-bg' });
  const box = h('div', { class: 'modal ' + cls }, content);
  bg.append(box);
  const close = () => bg.remove();
  if (dismiss) bg.addEventListener('pointerdown', (e) => { if (e.target === bg) close(); });
  overlay().append(bg);
  return { close, box };
}

// 어른 확인용 간단한 덧셈 문제
export function gate(onPass) {
  const a = 4 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 6), ans = a + b;
  const opts = shuffle([ans, ans + 1, ans - 2, ans + 3]);
  const m = modal(h('div', { class: 'gate' },
    h('div', { class: 'gq' }, '어른 확인'),
    h('div', { class: 'gq big' }, `${a} + ${b} = ?`),
    h('div', { class: 'gopts' }, opts.map((o) => h('button', {
      class: 'btn', onclick: () => { if (o === ans) { m.close(); onPass(); } else { sfx('boing'); m.close(); } },
    }, String(o)))),
    h('button', { class: 'btn ghost', onclick: () => m.close() }, '취소')));
}
