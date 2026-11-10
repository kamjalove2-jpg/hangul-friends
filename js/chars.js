// 내 캐릭터: 부모가 고른 사진을 이 기기(IndexedDB)에만 저장. 서버·GitHub에는 올라가지 않음.
import { idb, allEntries, persist } from './db.js';
import { guessLetters } from './data.js';

// letter: 연결된 자모('' = 연결 안 함), mode: replace(기존 그림·단어 대체) | add(기존에 더하기)
const list = []; // { id, name, hidden, letter, mode, blob, url, img }

const toImg = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });

function wrap(id, v) {
  const url = URL.createObjectURL(v.blob);
  const name = v.name || '';
  const letter = v.letter !== undefined ? v.letter : (guessLetters(name)[0] || ''); // 예전 캐릭터는 이름으로 자동 연결
  const c = { id, name, hidden: !!v.hidden, letter, mode: v.mode === 'add' ? 'add' : 'replace', t: v.t || 0, blob: v.blob, url, img: null };
  toImg(url).then((i) => { c.img = i; }).catch(() => {});
  return c;
}

export async function loadChars() {
  persist();
  try {
    const rows = await allEntries('img');
    list.length = 0;
    rows.forEach(([k, v]) => v && v.blob && list.push(wrap(k, v)));
    list.sort((a, b) => a.t - b.t);
  } catch { /* 사용 불가 */ }
}

export const allChars = () => list;
export const chars = () => list.filter((c) => !c.hidden);
const pickOne = (a) => (a.length ? a[Math.floor(Math.random() * a.length)] : null);
// 무작위 응원 캐릭터 (이미 화면에 나온 캐릭터는 빼고)
export const randomChar = (except = null) => pickOne(chars().filter((c) => c !== except));

// 이름 앞에 붙인 자모("ㄹ 로디")는 떼고 부르기
export const callName = (c) => (c.name || '').replace(/^[\u3131-\u3163]\s*/, '').trim();

// 글자에 연결된 캐릭터 (여러 개면 무작위, first=true면 항상 첫 번째)
export function letterChar(id, first = false) {
  const a = chars().filter((c) => c.letter === id);
  return first ? a[0] || null : pickOne(a);
}

// 글자에 캐릭터 입히기: 단어와 그림을 캐릭터 기준으로 바꾼 글자 객체
export function skin(L, first = false) {
  const c = letterChar(L.id, first);
  if (!c) return { ...L, char: null, mode: '' };
  const nm = callName(c) || L.word;
  return { ...L, char: c, mode: c.mode, word: c.mode === 'add' ? `${L.word}! ${nm}` : nm };
}

// 글자 그림: 대체면 캐릭터 사진, 아니면 이모지
export const art = (sk, cls = '') => (sk.char && sk.mode === 'replace' ? charEl(sk.char, cls) : sk.emoji);

async function put(c) {
  await idb('img', 'readwrite', (s) => s.put({ name: c.name, hidden: c.hidden, letter: c.letter, mode: c.mode, t: c.t, blob: c.blob }, c.id));
}

export async function addChar(blob, name, letter, mode = 'replace') {
  if (letter === undefined) letter = guessLetters(name)[0] || '';
  const c = wrap('c' + Date.now() + Math.floor(Math.random() * 1000), { name, letter, mode, blob, t: Date.now() });
  await put(c);
  list.push(c);
  return c;
}

export async function setHidden(c, hidden) { c.hidden = hidden; await put(c); }
export async function setLink(c, letter, mode) { c.letter = letter; c.mode = mode; await put(c); }
export async function delChar(c) {
  await idb('img', 'readwrite', (s) => s.delete(c.id));
  const i = list.indexOf(c); if (i >= 0) list.splice(i, 1);
}

// ---------- 이미지 처리 ----------
export async function fileToCanvas(file, max = 256) {
  const url = URL.createObjectURL(file);
  try {
    const img = await toImg(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(img.naturalWidth * k));
    cv.height = Math.max(1, Math.round(img.naturalHeight * k));
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
    return cv;
  } finally { URL.revokeObjectURL(url); }
}

// 테두리에서 이어지는 흰색/단색 배경을 투명하게 (이미 투명한 PNG면 그대로)
export function removeBg(cv) {
  const ctx = cv.getContext('2d'), w = cv.width, hgt = cv.height;
  const im = ctx.getImageData(0, 0, w, hgt), d = im.data;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, x + (hgt - 1) * w);
  for (let y = 0; y < hgt; y++) border.push(y * w, w - 1 + y * w);
  if (border.some((i) => d[i * 4 + 3] < 200)) return cv; // 이미 투명 배경
  // 테두리에서 가장 많은 색(대략)을 배경색으로
  const cnt = {};
  let best = null, bn = 0;
  for (const i of border) {
    const key = (d[i * 4] >> 4) + ',' + (d[i * 4 + 1] >> 4) + ',' + (d[i * 4 + 2] >> 4);
    cnt[key] = (cnt[key] || 0) + 1;
    if (cnt[key] > bn) { bn = cnt[key]; best = i; }
  }
  if (bn < border.length * 0.4) return cv; // 배경이 단색이 아니면 건드리지 않음
  const br = d[best * 4], bg = d[best * 4 + 1], bb = d[best * 4 + 2];
  const near = (i) => Math.abs(d[i * 4] - br) + Math.abs(d[i * 4 + 1] - bg) + Math.abs(d[i * 4 + 2] - bb) < 70;
  const seen = new Uint8Array(w * hgt), stack = border.filter(near);
  stack.forEach((i) => { seen[i] = 1; });
  while (stack.length) {
    const i = stack.pop();
    d[i * 4 + 3] = 0;
    const x = i % w, y = (i - x) / w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < hgt - 1 ? i + w : -1]) {
      if (j >= 0 && !seen[j] && near(j)) { seen[j] = 1; stack.push(j); }
    }
  }
  ctx.putImageData(im, 0, 0);
  return cv;
}

export const canvasBlob = (cv) => new Promise((res) => cv.toBlob(res, 'image/png'));

// 사진을 선 그림으로 바꾸기 (따라 그리기 밑그림용)
export function outline(src, w, hgt) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hgt;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);
  ctx.drawImage(src, 0, 0, w, hgt);
  const im = ctx.getImageData(0, 0, w, hgt), d = im.data;
  const g = new Float32Array(w * hgt);
  for (let i = 0; i < w * hgt; i++) g[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  const out = ctx.createImageData(w, hgt), o = out.data;
  for (let y = 1; y < hgt - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      const m = Math.hypot(gx, gy);
      if (m > 90) { o[i * 4] = o[i * 4 + 1] = o[i * 4 + 2] = 60; o[i * 4 + 3] = Math.min(255, m); }
    }
  }
  ctx.clearRect(0, 0, w, hgt);
  ctx.putImageData(out, 0, 0);
  return cv;
}

// 캐릭터를 보여줄 <img> 요소
export function charEl(c, cls = '') {
  const i = document.createElement('img');
  i.src = c.url; i.alt = c.name; i.className = 'charimg ' + cls; i.draggable = false;
  return i;
}
