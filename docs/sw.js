/**
 * Service Worker 鈥斺€?涓浗璞℃ AI 瀵瑰紙绂荤嚎缂撳瓨
 *
 * 缂撳瓨绛栫暐锛?
 * - HTML 瀵艰埅璇锋眰锛歂etworkFirst锛堜繚璇佺増鏈洿鏂板嵆鏃剁敓鏁堬紝绂荤嚎鏃跺洖閫€缂撳瓨锛?
 * - data/pikafish.data锛堢害4MB锛岀缁忕綉缁滄墦鍖呮枃浠讹級锛欳acheFirst锛堜竴鏃︾紦瀛樼粷涓嶅娆′笅杞斤級
 * - js/wasm/css 绛夊皬鏂囦欢锛歋taleWhileRevalidate锛堢寮€锛屽悓鏃跺悗鍙伴潤榛樻洿鏂帮級
 *
 * 鍏抽敭瀹炵幇锛氭墍鏈夊悗鍙扮紦瀛樺啓鍏ラ兘閫氳繃 event.waitUntil 淇濇椿锛?
 * 閬垮厤 Service Worker 鍦ㄥぇ鏂囦欢娴佸紡鍥炰紶閫斾腑琚祻瑙堝櫒缁堟鑰屽鑷磋姹傛寕璧枫€?
 *
 * 鏇存柊寮曟搸鎴栭〉闈㈠悗锛屾妸 CACHE_VERSION 鍔?1锛屾棫缂撳瓨浼氬湪 activate 鏃惰嚜鍔ㄦ竻鐞嗐€?
 */
const CACHE_VERSION = 'xiangqi-v13';
const CORE_CACHE = CACHE_VERSION + '-core';
const DATA_CACHE = CACHE_VERSION + '-data';

// install 鏃跺彧棰勭紦瀛樺皬鏂囦欢锛?MB 鐨?.data 缃戠粶鍖呬笉棰勭紦瀛橈紙閬垮厤瀹夎澶辫触锛夛紝棣栨浣跨敤鏃惰繍琛屾椂缂撳瓨
const CORE_ASSETS = [
    './',
    './index.html',
    './js/rules.js',
    './pikafish-engine.js',
    './worker.js',
    './pikafish.js',
    './pikafish.wasm',
    './manifest.webmanifest',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
            .catch((err) => {
                // 棰勭紦瀛樺け璐ヤ笉搴旈樆鏂?SW 瀹夎锛堜緥濡傛煇涓枃浠舵殏鏃?404锛?
                console.warn('[SW] 棰勭紦瀛橀儴鍒嗗け璐?', err);
                return self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => !k.startsWith(CACHE_VERSION))
                    .map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// CacheFirst锛氱敤浜庡紩鎿庣綉缁滃寘 .data锛屽懡涓紦瀛樼洿鎺ヨ繑鍥烇紝缁濅笉閲嶅涓嬭浇
// event.waitUntil 璁?SW 涓庣紦瀛樺啓鍏ュ悓鐢熷懡鍛ㄦ湡锛屼繚璇佹祦寮忓搷搴斾笉琚腑閫斿洖鏀?
function cacheFirst(request, cacheName, event) {
    return caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') {
                const copy = resp.clone();
                event.waitUntil(
                    caches.open(cacheName).then((cache) => cache.put(request, copy))
                );
            }
            return resp;
        });
    });
}

// StaleWhileRevalidate锛氱紦瀛樼珛鍗宠繑鍥烇紝鍚庡彴闈欓粯鏇存柊锛堜粎鐢ㄤ簬灏忔枃浠讹級
function staleWhileRevalidate(request, cacheName, event) {
    return caches.match(request).then((cached) => {
        const network = fetch(request).then((resp) => {
            if (resp && resp.status === 200) {
                const copy = resp.clone();
                event.waitUntil(
                    caches.open(cacheName).then((cache) => cache.put(request, copy))
                );
            }
            return resp;
        }).catch(() => cached);
        return cached || network;
    });
}

// NetworkFirst锛氱敤浜?HTML锛屼紭鍏堝彇鏈€鏂扮増鏈紝鏂綉鏃跺洖閫€缂撳瓨
function networkFirst(request, event) {
    return fetch(request).then((resp) => {
        if (resp && resp.status === 200) {
            const copy = resp.clone();
            event.waitUntil(
                caches.open(CORE_CACHE).then((cache) => cache.put('./index.html', copy))
            );
        }
        return resp;
    }).catch(() => caches.match(request).then((r) => r || caches.match('./index.html')));
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // 璺ㄦ簮璇锋眰鐩存帴鏀捐

    // 椤甸潰瀵艰埅锛歂etworkFirst
    if (req.mode === 'navigate') {
        event.respondWith(networkFirst(req, event));
        return;
    }

    // 寮曟搸绁炵粡缃戠粶鎵撳寘鏂囦欢 .data锛欳acheFirst
    if (url.pathname.endsWith('.data')) {
        event.respondWith(cacheFirst(req, DATA_CACHE, event));
        return;
    }

    // 鍏朵粬闈欐€佸皬鏂囦欢锛歋taleWhileRevalidate
    if (/\.(js|wasm|css|png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$/.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(req, CORE_CACHE, event));
    }
});
