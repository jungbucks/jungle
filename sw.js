const CACHE = 'jungle-v32';

const ASSETS = [
  './',
  './assets/style.css',
  './assets/fonts/PretendardVariable.woff2',
  './assets/app.js',
  './assets/boot.js',
  './assets/state.js',
  './assets/utils.js',
  './assets/data.js',
  './assets/simulator.js',
  './assets/chasi.js',
  './assets/evalplan.js',
  './assets/lessonplan.js',
  './assets/rubric.js',
  './assets/regexam.js',
  './assets/gradecalc.js',
  './assets/stdpicker.js',
  './assets/codevar.js',
  './assets/aiidea.js',
  './assets/gemini.js',
  './assets/textbook.js',
  './assets/appstore.js',
  './assets/resources.js',
  './assets/overview.js',
  './assets/achv.js',
  './assets/home.js',
  './assets/collect.js',
  './assets/backup.js',
  './assets/searchfx.js',
  './images/jungle.png',
  './images/icon.svg',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/icon-maskable-192.png',
  './images/icon-maskable-512.png',
  './images/apps/markdown.png',
  './images/apps/py_visual.png',
  './images/apps/data-science.png',
  './images/apps/sort-lab.svg',
  './images/apps/sw-life.svg',
  './images/apps/cipher.svg',
];

// ── install: 개별 캐싱 (파일 하나가 404여도 나머지는 캐시) ──
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const results = await Promise.allSettled(
      // cache:'reload' → HTTP 캐시 무시하고 서버에서 새로 받음
      ASSETS.map(url => cache.add(new Request(url, { cache: 'reload' })))
    );
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.warn('[SW] 프리캐시 실패(무시하고 진행):', ASSETS[i]);
    });
  })());
  self.skipWaiting();
});

// ── activate: 옛 버전 캐시 정리 ──
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// ── fetch: 자원 유형별 전략 ──
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 외부(CDN 폰트 등)는 통과

  // HTML 내비게이션 → network-first (항상 최신 앱 셸, 오프라인 시 캐시)
  if (req.mode === 'navigate') {
    e.respondWith(networkFirst(req));
    return;
  }

  // JS/CSS → stale-while-revalidate (즉시 캐시 응답 + 백그라운드 갱신)
  //   → 버전업 없이도 다음 방문에 자동으로 최신화 (stale 문제 해소)
  if (/\.(?:js|mjs|css)$/.test(url.pathname)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 이미지 등 정적 자원 → cache-first
  e.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    return cached || (await cache.match('./')) || Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return cached || Response.error();
  }
}
