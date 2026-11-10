// 오프라인 지원: 캐시 우선 + 백그라운드 갱신. 파일을 바꾸면 VERSION을 올려주세요.
const VERSION = 'hangul-v3';
const ASSETS = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/data.js', 'js/store.js', 'js/audio.js', 'js/trace.js', 'js/ui.js', 'js/games.js', 'js/book.js',
  'js/db.js', 'js/chars.js', 'js/draw.js', 'js/pictures.js',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => hit || caches.match('index.html'));
    return hit || net;
  }));
});
