/**
 * 提取 docs/index.html 里的内联 <script type="module"> 并做语法检查。
 * 内联脚本无法直接 node --check，这里抽到临时 .mjs 再校验，供 CI 与本地使用。
 * 用法：node scripts/check-inline-module.cjs
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const htmlPath = path.join(__dirname, '..', 'docs', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const re = /<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g;
let m, idx = 0, failed = 0;
while ((m = re.exec(html)) !== null) {
    idx++;
    const code = m[1];
    const tmp = path.join(os.tmpdir(), `inline-module-${process.pid}-${idx}.mjs`);
    fs.writeFileSync(tmp, code, 'utf8');
    try {
        execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
        console.log(`inline module #${idx}: syntax OK (${code.length} chars)`);
    } catch (e) {
        failed++;
        console.error(`inline module #${idx}: SYNTAX ERROR\n` + (e.stderr ? e.stderr.toString() : e.message));
    } finally {
        fs.rmSync(tmp, { force: true });
    }
}
if (idx === 0) {
    console.error('No inline module script found — selector may be wrong.');
    process.exit(1);
}
process.exit(failed ? 1 : 0);
