import { store } from './store.js';

// ---------- 효과음 (WebAudio 합성) ----------
let ctx;
export function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
  } catch { /* 무시 */ }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.18) {
  if (!ctx || !store.settings.sound) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  const t = ctx.currentTime + t0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfx(name) {
  unlock();
  switch (name) {
    case 'tap': tone(660, 0, 0.1, 'triangle'); break;
    case 'stroke': tone(784, 0, 0.12); tone(988, 0.09, 0.16); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.32, 'triangle', 0.2)); break;
    case 'pop': tone(240, 0, 0.07, 'square', 0.1); tone(900, 0, 0.12, 'sine', 0.2); break;
    case 'boing': tone(260, 0, 0.16); tone(190, 0.12, 0.22); break;
    case 'star': tone(1047, 0, 0.1); tone(1568, 0.08, 0.22); break;
    case 'merge': tone(440, 0, 0.12, 'triangle'); tone(660, 0.1, 0.12, 'triangle'); tone(880, 0.2, 0.25, 'triangle'); break;
  }
}

// ---------- 음성 (TTS + 부모 녹음) ----------
let voice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices();
  voice = vs.find((v) => /ko[-_]KR/i.test(v.lang)) || vs.find((v) => v.lang.startsWith('ko')) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

const player = new Audio();
const recUrls = {}; // key -> objectURL (메모리 캐시: iOS에서 동기 재생을 위해)

export function stopVoice() {
  try { speechSynthesis.cancel(); } catch { /* 무시 */ }
  try { player.pause(); } catch { /* 무시 */ }
}

export function speak(text, rate = 0.8) {
  if (!store.settings.sound || !('speechSynthesis' in window)) return;
  stopVoice();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; if (voice) u.voice = voice;
  u.rate = rate; u.pitch = 1.2;
  speechSynthesis.speak(u);
}

// 글자 읽어주기: 부모 녹음이 있으면 그것을, 없으면 TTS
export function sayLetter(l, full = true) {
  if (!store.settings.sound) return;
  const url = recUrls['L:' + l.id];
  if (url) {
    stopVoice();
    player.src = url;
    player.play().catch(() => speak(full ? `${l.say}. ${l.word}!` : l.say));
    return;
  }
  speak(full ? `${l.say}. ${l.word}!` : l.say);
}

export const hasRec = (id) => !!recUrls['L:' + id];

// ---------- IndexedDB 녹음 저장 ----------
const open = () => new Promise((res, rej) => {
  const r = indexedDB.open('hangul', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('rec');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

async function idb(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction('rec', mode);
    const rq = fn(t.objectStore('rec'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
}

export async function preloadRecs() {
  try {
    const keys = await idb('readonly', (s) => s.getAllKeys());
    for (const k of keys) {
      const blob = await idb('readonly', (s) => s.get(k));
      if (blob) recUrls[k] = URL.createObjectURL(blob);
    }
  } catch { /* IndexedDB 사용 불가 */ }
}

export async function startRec() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = new MediaRecorder(stream);
  const chunks = [];
  mr.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise((res) => {
    mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: mr.mimeType || 'audio/mp4' })); };
  });
  mr.start();
  return { stop: () => { mr.stop(); return done; } };
}

export async function saveRec(id, blob) {
  await idb('readwrite', (s) => s.put(blob, 'L:' + id));
  recUrls['L:' + id] = URL.createObjectURL(blob);
}

export async function delRec(id) {
  await idb('readwrite', (s) => s.delete('L:' + id));
  delete recUrls['L:' + id];
}
