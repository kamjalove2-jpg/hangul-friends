const KEY = 'hangul_v1';

const def = () => ({
  stickers: {}, // { 'ㄱ': {count, first} , name: {...} }
  stars: 0,
  days: {}, // 출석 { '2026-11-06': true }
  play: {}, // 하루 사용 초
  bonus: {}, // 하루 추가 분
  name: '',
  settings: { limit: 20, easy: true, sound: true },
  board: {},
  bg: 'meadow',
});

let S;
try {
  S = { ...def(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {
  S = def();
}
S.settings = { ...def().settings, ...S.settings };

export const store = S;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 저장 불가 시 무시 */ }
}

export function today(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function addTrace(id) {
  const isNew = !S.stickers[id];
  const s = S.stickers[id] || (S.stickers[id] = { count: 0, first: today() });
  s.count++;
  save();
  return isNew;
}

export function addStars(n) { S.stars += n; save(); }

export function markDay() { S.days[today()] = true; save(); }

export function tick(sec) {
  const t = today();
  S.play[t] = (S.play[t] || 0) + sec;
}

export function limitSeconds() {
  const lim = S.settings.limit;
  if (!lim) return Infinity;
  return (lim + (S.bonus[today()] || 0)) * 60;
}

export function resetAll() {
  const d = def();
  for (const k of Object.keys(S)) delete S[k];
  Object.assign(S, d);
  save();
}
