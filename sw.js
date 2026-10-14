/* Service Worker - SMK Asajaya
 * Hanya cache "kulit" aplikasi (halaman pembungkus + ikon) supaya app
 * dibuka pantas & boleh dipasang. Data sebenar sentiasa diambil terus
 * dari Google Apps Script (tidak dicache) supaya maklumat sentiasa terkini.
 * Naikkan nombor versi bila fail di folder ini diubah.
 */
const CACHE = 'smka-shell-v1';
const SHELL = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // jangan sentuh Google/CDN

  if (req.mode === 'navigate') {
    // Rangkaian dahulu; jika luar talian, papar halaman offline
    e.respondWith(
      fetch(req)
        .then((res) => { caches.open(CACHE).then((c) => c.put('./index.html', res.clone())); return res; })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./offline.html')))
    );
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
