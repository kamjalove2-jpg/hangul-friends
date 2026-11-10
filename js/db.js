// IndexedDB: 'rec' = 부모 녹음, 'img' = 내 캐릭터 이미지 (모두 이 기기 안에만 저장)
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open('hangul', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('rec')) db.createObjectStore('rec');
      if (!db.objectStoreNames.contains('img')) db.createObjectStore('img');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error); };
  });
  return dbp;
}

export async function idb(name, mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(name, mode);
    const rq = fn(t.objectStore(name));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

export async function allEntries(name) {
  const keys = await idb(name, 'readonly', (s) => s.getAllKeys());
  const vals = await idb(name, 'readonly', (s) => s.getAll());
  return keys.map((k, i) => [k, vals[i]]);
}

// 사파리가 저장소를 임의로 지우지 않도록 요청
export function persist() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* 무시 */ }
}
