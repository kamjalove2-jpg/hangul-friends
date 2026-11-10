const KEY = 'hangul_v1';

const def = () => ({
  stickers: {}, // { 'ㄱ': {count, first} , name: {...} }
  stars: 0,
  days: {}, // 출석 { '2026-11-06': true }
  play: {}, // 하루 사용 초
  bonus: {}, // 하루 추가 분
  name: '',
  // level: easy|normal|hard|expert, vol: normal|loud|max, voice: TTS voiceURI('' = 자동), play: both|rec|ai
  settings: { limit: 20, level: 'easy', sound: true, vol: 'loud', voice: '', play: 'both' },
  board: {},
  pics: {}, // 따라 그리기 완성 횟수 { 'car': 2 }
  bg: 'meadow',
});

let S;
try {
  S = { ...def(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
} catch {
  S = def();
}
// 예전 버전(easy: true/false) 설정 이어받기
if (S.settings && !S.settings.level && S.settings.easy === false) S.settings.level = 'normal';
S.settings = { ...def().settings, ...S.settings };
delete S.settings.easy;

export const store = S;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* 저장 불가 시 무시 */ }
}

export function today(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function addTrace(id, gold = false) {
  const isNew = !S.stickers[id];
  const s = S.stickers[id] || (S.stickers[id] = { count: 0, first: today() });
  s.count++;
  if (gold) s.gold = (s.gold || 0) + 1;
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
