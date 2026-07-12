/* ═══════════════════════════════════════════════════════════════
 *  VEE DISCOGRAPHY  —  Service Worker
 *  ทำให้ติดตั้งเป็น PWA ได้ + cache หน้าเว็บสำหรับเปิดเร็ว/ออฟไลน์
 * ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'vee-discography-v3';

// ไฟล์ที่ cache ไว้ (app shell)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── install: cache app shell ──────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── activate: ล้าง cache เก่า ─────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── fetch ─────────────────────────────────────────────────────────
// - request ไป Apps Script (API) → network เสมอ (ไม่ cache ข้อมูลสด)
// - ไฟล์ app shell → cache-first (เปิดเร็ว/ออฟไลน์ได้)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // ไม่ cache request ที่ยิงไป Apps Script backend
  if (url.includes('script.google.com') || url.includes('script.googleusercontent.com')) {
    return; // ปล่อยให้ browser จัดการปกติ (network)
  }

  // เฉพาะ GET เท่านั้นที่ cache
  if (event.request.method !== 'GET') return;

  // ── index.html / หน้าหลัก → network-first (โค้ด UI อัปเดตทันทีเสมอ) ──
  const isHtmlPage = event.request.mode === 'navigate'
    || url.endsWith('/') || url.endsWith('index.html');
  if (isHtmlPage) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))  // ออฟไลน์ค่อยใช้ cache
    );
    return;
  }

  // ── ไฟล์อื่น (icon/manifest) → cache-first (เปิดเร็ว) ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
