import { store } from './store.js';
import { idb, allEntries } from './db.js';

// iPad가 앱 소리를 "미디어 재생"으로 다루도록 (무음 스위치·벨소리 음량 영향 줄이기, Safari 17+)
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 무시 */ }

// ---------- 오디오 출력: 마스터 음량 → 컴프레서(소리 깨짐 방지) → 스피커 ----------
let ctx = null, master = null;
const VOL = { normal: 1.3, loud: 2.2, max: 3.2 };

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master = ctx.createGain();
    master.connect(comp).connect(ctx.destination);
    applyVolume();
  } catch { ctx = null; }
  return ctx;
}

export function applyVolume() { if (master) master.gain.value = VOL[store.settings.vol] || VOL.loud; }

export function unlock() {
  const c = ensure();
  try { if (c && c.state !== 'running') c.resume(); } catch { /* 무시 */ }
}

function tone(freq, t0, dur, type = 'sine', vol = 0.3) {
  if (!ctx || !store.settings.sound) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  const t = ctx.currentTime + t0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export function sfx(name) {
  unlock();
  switch (name) {
    case 'tap': tone(660, 0, 0.1, 'triangle'); break;
    case 'stroke': tone(784, 0, 0.12); tone(988, 0.09, 0.16); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.32, 'triangle', 0.32)); break;
    case 'pop': tone(240, 0, 0.07, 'square', 0.15); tone(900, 0, 0.12, 'sine', 0.3); break;
    case 'boing': tone(260, 0, 0.16); tone(190, 0.12, 0.22); break;
    case 'star': tone(1047, 0, 0.1); tone(1568, 0.08, 0.22); break;
    case 'merge': tone(440, 0, 0.12, 'triangle'); tone(660, 0.1, 0.12, 'triangle'); tone(880, 0.2, 0.25, 'triangle'); break;
    case 'soft': tone(523, 0, 0.14, 'triangle', 0.22); tone(659, 0.12, 0.2, 'triangle', 0.22); break;
  }
}

// ---------- AI 음성 (기기 TTS) ----------
let voice = null;
const isKo = (v) => /^ko/i.test(v.lang);
// 고품질 음성 우선: 프리미엄 > 향상됨 > 기본
const score = (v) => (/premium|프리미엄/i.test(v.name) ? 3 : 0) + (/enhanced|향상|고품질|neural|natural/i.test(v.name) ? 2 : 0) + (v.localService ? 0.5 : 0);

export function koVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis.getVoices().filter(isKo).sort((a, b) => score(b) - score(a));
}

export function pickVoice() {
  const vs = koVoices();
  voice = vs.find((v) => v.voiceURI === store.settings.voice) || vs[0] || null;
  return voice;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }

let seq = 0, curSrc = null;
const player = new Audio();

export function stopVoice() {
  seq++;
  try { speechSynthesis.cancel(); } catch { /* 무시 */ }
  try { if (curSrc) curSrc.stop(); } catch { /* 무시 */ }
  curSrc = null;
  try { player.pause(); } catch { /* 무시 */ }
}

// 말하기 (끝나면 resolve). iOS는 onend가 가끔 안 와서 시간 제한을 둠
function say(text, rate = 0.8) {
  return new Promise((res) => {
    if (!store.settings.sound || !('speechSynthesis' in window) || !text) return res();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; if (voice) u.voice = voice;
    u.rate = rate; u.pitch = 1.1; u.volume = 1;
    let done = false;
    const t = setTimeout(() => fin(), 1500 + (text.length * 320) / rate);
    const fin = () => { if (!done) { done = true; clearTimeout(t); res(); } };
    u.onend = fin; u.onerror = fin;
    speechSynthesis.speak(u);
  });
}

export function speak(text, rate = 0.8) {
  stopVoice();
  return say(text, rate);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 글자 읽어주기. 재생 방식(설정): both = AI 다음 부모 녹음, rec = 녹음만, ai = AI만
export async function sayLetter(l, full = true) {
  if (!store.settings.sound) return;
  stopVoice();
  const my = seq, key = 'L:' + l.id, mode = store.settings.play;
  const text = full ? `${l.say}. ${l.word}!` : l.say;
  const has = !!recs[key];
  if (!has || mode === 'ai' || (!full && mode === 'both')) return say(text);
  if (mode === 'rec') return playRec(key, my);
  await say(text);
  if (my !== seq) return;
  await wait(200);
  if (my !== seq) return;
  return playRec(key, my);
}

// ---------- 부모 녹음: 음량 자동 맞춤 후 증폭 재생 ----------
const recs = {}; // key -> { blob, url, buf, gain }

export const hasRec = (id) => !!recs['L:' + id];

async function prepare(key, blob) {
  const r = { blob, url: URL.createObjectURL(blob), buf: null, gain: 1 };
  recs[key] = r;
  const c = ensure();
  if (!c) return r;
  try {
    const ab = await blob.arrayBuffer();
    const buf = await new Promise((res, rej) => {
      const p = c.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
    let peak = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i += 4) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    }
    r.buf = buf;
    r.gain = peak > 0.01 ? Math.min(6, 0.5 / peak) : 1; // 피크를 맞춘 뒤 마스터 음량으로 키움
  } catch { /* 디코딩 실패 시 기본 재생 */ }
  return r;
}

function playRec(key, my = seq) {
  const r = recs[key];
  if (!r || my !== seq) return Promise.resolve();
  unlock();
  if (r.buf && ctx) {
    return new Promise((res) => {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = r.buf; g.gain.value = r.gain;
      src.connect(g).connect(master);
      src.onended = () => { if (curSrc === src) curSrc = null; res(); };
      curSrc = src; src.start();
    });
  }
  return new Promise((res) => {
    player.src = r.url; player.onended = res; player.onerror = res;
    player.play().catch(res);
  });
}

export async function preloadRecs() {
  try {
    for (const [k, blob] of await allEntries('rec')) if (blob) await prepare(k, blob);
  } catch { /* IndexedDB 사용 불가 */ }
}

export async function startRec() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true } });
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
  await idb('rec', 'readwrite', (s) => s.put(blob, 'L:' + id));
  await prepare('L:' + id, blob);
}

export async function delRec(id) {
  await idb('rec', 'readwrite', (s) => s.delete('L:' + id));
  delete recs['L:' + id];
}

// 받침에 맞는 조사 고르기: josa('아', '을', '를') → '아를'
export function josa(word, withB, withoutB) {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  const has = c >= 0 && c <= 11171 && c % 28 !== 0;
  return word + (has ? withB : withoutB);
}
