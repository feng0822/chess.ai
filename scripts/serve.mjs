/**
 * 零依赖静态预览服务器（替代 python -m http.server，且能正确返回 .wasm MIME）。
 * 用法：npm run serve [端口]，默认 8170，根目录为 docs/。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', 'docs');
const PORT = Number(process.argv[2] || process.env.PORT || 8170);

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.wasm': 'application/wasm',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.data': 'application/octet-stream',
    '.css': 'text/css; charset=utf-8'
};

http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(filePath, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('Not Found: ' + urlPath); }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
        res.end(buf);
    });
}).listen(PORT, () => {
    console.log(`象棋项目本地预览: http://localhost:${PORT}/  (根目录 docs/)`);
});
