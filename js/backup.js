// 전체 백업: 부모 설정 + 내 캐릭터 + 내 녹음 (+ 진행도)을 파일 하나로. 서버 없이 기기끼리 옮길 때 사용.
import { store, save } from './store.js';
import { allChars, addChar, delChar, setHidden } from './chars.js';
import { recEntries, saveRec, delRec, applyVolume, pickVoice } from './audio.js';

const blobToData = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
const dataToBlob = async (d) => (await fetch(d)).blob();

// AI 목소리는 기기마다 설치된 목소리가 달라 옮기지 않음
const SETTING_KEYS = ['limit', 'level', 'sound', 'vol', 'play'];
const PROGRESS_KEYS = ['stickers', 'stars', 'days', 'pics', 'board', 'bg'];

export async function exportAll({ progress = true } = {}) {
  const settings = {};
  SETTING_KEYS.forEach((k) => { settings[k] = store.settings[k]; });
  const out = { app: 'hangul-friends', kind: 'full', v: 2, at: new Date().toISOString(), settings, name: store.name, chars: [], recs: [] };
  if (progress) { out.progress = {}; PROGRESS_KEYS.forEach((k) => { out.progress[k] = store[k]; }); }
  for (const c of allChars()) out.chars.push({ name: c.name, hidden: c.hidden, letter: c.letter, mode: c.mode, data: await blobToData(c.blob) });
  for (const [id, blob] of recEntries()) out.recs.push({ id, data: await blobToData(blob) });
  return new Blob([JSON.stringify(out)], { type: 'application/json' });
}

export function backupName() {
  const d = new Date();
  return `hangul-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
}

export async function readBackup(file) {
  const j = JSON.parse(await file.text());
  if (!j || j.app !== 'hangul-friends' || !Array.isArray(j.chars)) throw new Error('백업 파일이 아니에요');
  return j;
}

// 진행도 합치기: 스티커는 많은 쪽, 출석은 합집합
function mergeProgress(p) {
  for (const [id, s] of Object.entries(p.stickers || {})) {
    const m = store.stickers[id];
    if (!m) store.stickers[id] = s;
    else { m.count = Math.max(m.count || 0, s.count || 0); if (s.gold) m.gold = Math.max(m.gold || 0, s.gold); }
  }
  store.stars = Math.max(store.stars || 0, p.stars || 0);
  Object.assign(store.days, p.days || {});
  for (const [id, n] of Object.entries(p.pics || {})) store.pics[id] = Math.max(store.pics[id] || 0, n);
  store.board = { ...(p.board || {}), ...store.board };
}

// mode: 'merge' = 기존 유지 + 새 것 더하기, 'replace' = 이 기기 내용을 백업으로 바꾸기
export async function importAll(j, mode = 'merge') {
  const r = { chars: 0, recs: 0, settings: false, progress: false };
  if (j.settings) {
    SETTING_KEYS.forEach((k) => { if (j.settings[k] !== undefined) store.settings[k] = j.settings[k]; });
    r.settings = true;
  }
  if (typeof j.name === 'string' && (mode === 'replace' || !store.name)) store.name = j.name;
  if (j.progress) {
    if (mode === 'replace') PROGRESS_KEYS.forEach((k) => { if (j.progress[k] !== undefined) store[k] = j.progress[k]; });
    else mergeProgress(j.progress);
    r.progress = true;
  }
  save(); applyVolume(); pickVoice();

  // 캐릭터: 합치기면 같은 사진(이름+데이터 같음)은 건너뜀
  if (mode === 'replace') for (const c of [...allChars()]) await delChar(c);
  const have = new Set(await Promise.all(allChars().map(async (c) => c.name + '|' + (await blobToData(c.blob)).length)));
  for (const it of j.chars) {
    if (!it.data || have.has(it.name + '|' + it.data.length)) continue;
    const c = await addChar(await dataToBlob(it.data), it.name || '', it.letter, it.mode === 'add' ? 'add' : 'replace');
    if (it.hidden) await setHidden(c, true);
    r.chars++;
  }

  // 녹음: 같은 글자는 백업 쪽으로
  if (mode === 'replace') for (const [id] of recEntries()) await delRec(id);
  for (const it of j.recs || []) {
    if (!it.id || !it.data) continue;
    await saveRec(it.id, await dataToBlob(it.data));
    r.recs++;
  }
  return r;
}

// 파일 저장: iPad는 공유 시트(AirDrop·파일·카톡), PC는 다운로드
export async function saveFile(blob, filename) {
  const file = new File([blob], filename, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '한글 친구들 백업' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
