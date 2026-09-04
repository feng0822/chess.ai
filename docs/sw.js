/**
 * Service Worker —— 中国象棋 AI 对弈离线缓存
 *
 * 缓存策略：
 * - HTML 导航请求：NetworkFirst（保证版本更新即时生效，离线时回退缓存）
 * - data/pikafish.data（约4MB，神经网络打包文件）：CacheFirst（一旦缓存绝不多次下载）
 * - js/wasm/css 等小文件：StaleWhileRevalidate（秒开，同时后台静默更新）
 *
 * 关键实现：所有后台缓存写入都通过 event.waitUntil 保活，
 * 避免 Service Worker 在大文件流式回传途中被浏览器终止而导致请求挂起。
 *
 * 更新引擎或页面后，把 CACHE_VERSION 加 1，旧缓存会在 activate 时自动清理。
 */
const CACHE_VERSION = 'xiangqi-v4';
const CORE_CACHE = CACHE_VERSION + '-core';
const DATA_CACHE = CACHE_VERSION + '-data';

// install 时只预缓存小文件；4MB 的 .data 网络包不预缓存（避免安装失败），首次使用时运行时缓存
const CORE_ASSETS = [
    './',
    './index.html',
    './pikafish-engine.js',
    './worker.js',
    './pikafish.js',
    './pikafish.wasm'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CORE_CACHE)
            .then((cache) => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
            .catch((err) => {
                // 预缓存失败不应阻断 SW 安装（例如某个文件暂时 404）
                console.warn('[SW] 预缓存部分失败:', err);
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

// CacheFirst：用于引擎网络包 .data，命中缓存直接返回，绝不重复下载
// event.waitUntil 让 SW 与缓存写入同生命周期，保证流式响应不被中途回收
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

// StaleWhileRevalidate：缓存立即返回，后台静默更新（仅用于小文件）
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

// NetworkFirst：用于 HTML，优先取最新版本，断网时回退缓存
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
    if (url.origin !== self.location.origin) return; // 跨源请求直接放行

    // 页面导航：NetworkFirst
    if (req.mode === 'navigate') {
        event.respondWith(networkFirst(req, event));
        return;
    }

    // 引擎神经网络打包文件 .data：CacheFirst
    if (url.pathname.endsWith('.data')) {
        event.respondWith(cacheFirst(req, DATA_CACHE, event));
        return;
    }

    // 其他静态小文件：StaleWhileRevalidate
    if (/\.(js|wasm|css|png|jpg|jpeg|gif|svg|ico|webp)$/.test(url.pathname)) {
        event.respondWith(staleWhileRevalidate(req, CORE_CACHE, event));
    }
});
