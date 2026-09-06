/**
 * PikafishEngine - 皮卡鱼 WASM 前端封装
 * AI 运算全部在浏览器本地 Worker 中执行，无需后端服务器。
 * 神经网络已随引擎打包（data/pikafish.data，约 4MB），由 Worker 自动加载。
 */
class PikafishEngine {
    constructor(options = {}) {
        this.worker = null;
        this.ready = false;
        this.wasmUrl = options.wasmUrl || 'worker.js';
        this.onInfo = options.onInfo || null;
        this.onBestMove = options.onBestMove || null;
        this.onProgress = options.onProgress || null; // 文字进度回调
        this.onDownloadProgress = options.onDownloadProgress || null; // 兼容旧接口（本版由 status 驱动）
        this._uciReady = false;
        this._resolveQueue = [];
        this._bestMove = null;
        this._lastInfo = null;      // 最近一条 multipv=1 的 info（含 score/pv）
        this._pvLines = {};         // multipv 序号 -> 最新 info（多路线分析）
        this._multiPV = 1;          // 当前 MultiPV 设置
        this.onCrash = options.onCrash || null; // 运行期 Worker 崩溃回调（初始化完成后）
        this._crashed = false;
        // 皮卡鱼无 "Skill Level" 选项，用搜索深度区分五档强度
        this.searchDepth = 10;
    }

    _progress(text) {
        if (!text) return;
        console.log('[Pikafish]', text);
        if (this.onProgress) this.onProgress(text);
    }

    async init() {
        return new Promise((resolve, reject) => {
            this._progress('创建 Worker...');
            this.worker = new Worker(this.wasmUrl);

            // 引擎+网络约 4MB，正常数秒内就绪；60 秒超时兜底
            const timeout = setTimeout(() => {
                reject(new Error('初始化超时（网络较慢时请稍后重试，或改用本地 AI）'));
            }, 60000);

            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'stdout') {
                    this._handleStdout(msg.data);
                } else if (msg.type === 'stderr') {
                    console.warn('[Pikafish stderr]', msg.data);
                } else if (msg.type === 'status') {
                    // 引擎加载状态（如 Running...），仅作进度提示
                    if (msg.data) this._progress('引擎加载中...');
                } else if (msg.type === 'worker_error') {
                    clearTimeout(timeout);
                    reject(new Error('Worker内部错误: ' + msg.data));
                }
            };

            this.worker.onerror = (err) => {
                clearTimeout(timeout);
                if (this.ready) {
                    // 初始化已完成 -> 属于运行期 Worker 崩溃：标记失活并通知外部自愈，不再 reject（Promise 已解决）
                    this.ready = false; this._crashed = true;
                    try { if (this.worker) this.worker.terminate(); } catch (x) {}
                    this.worker = null;
                    if (this.onCrash) { try { this.onCrash(err); } catch (x) {} }
                    return;
                }
                reject(new Error('Worker错误: ' + err.message + ' (文件:' + err.filename + ':' + err.lineno + ')'));
            };

            // uci 由 Worker 在引擎就绪后自动发送，这里等待 uciok → isready → readyok
            this._waitFor('uciok').then(() => {
                this._progress('UCI 握手完成，等待引擎就绪...');
                this._uciReady = true;
                this._send('isready');
                return this._waitFor('readyok');
            }).then(() => {
                this.ready = true;
                clearTimeout(timeout);
                this._progress('引擎就绪！');
                resolve();
            }).catch(reject);
        });
    }

    _handleStdout(line) {
        if (!line) return;
        if (line.startsWith('info')) {
            const parsed = this._parseInfo(line);
            if (parsed.multipv) this._pvLines[parsed.multipv] = parsed;
            if (!parsed.multipv || parsed.multipv === 1) this._lastInfo = parsed;
            if (this.onInfo) this.onInfo(parsed);
        }
        if (line.startsWith('bestmove')) {
            const parts = line.split(/\s+/);
            this._bestMove = parts[1] || null;
            if (this.onBestMove) this.onBestMove(this._bestMove);
            this._resolveWaiting('bestmove');
        }
        if (line === 'uciok') this._resolveWaiting('uciok');
        if (line === 'readyok') this._resolveWaiting('readyok');
    }

    _parseInfo(line) {
        const info = { raw: line };
        const parts = line.split(/\s+/);
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === 'depth' && parts[i+1]) info.depth = parseInt(parts[i+1]);
            if (parts[i] === 'seldepth' && parts[i+1]) info.seldepth = parseInt(parts[i+1]);
            if (parts[i] === 'nodes' && parts[i+1]) info.nodes = parseInt(parts[i+1]);
            if (parts[i] === 'nps' && parts[i+1]) info.nps = parseInt(parts[i+1]);
            if (parts[i] === 'time' && parts[i+1]) info.time = parseInt(parts[i+1]);
            if (parts[i] === 'multipv' && parts[i+1]) info.multipv = parseInt(parts[i+1]);
            if (parts[i] === 'score' && parts[i+1] && parts[i+2]) {
                info.scoreType = parts[i+1]; // cp=厘兵分, mate=杀棋步数
                info.score = parseInt(parts[i+2]);
                if (parts[i+1] === 'mate') info.mate = info.score;
            }
            if (parts[i] === 'pv') info.pv = parts.slice(i+1);
        }
        return info;
    }

    _send(cmd) {
        if (this.worker) this.worker.postMessage(cmd);
    }

    _waitFor(token) {
        return new Promise((resolve) => {
            this._resolveQueue.push({ token, resolve });
        });
    }

    _resolveWaiting(token) {
        const idx = this._resolveQueue.findIndex(r => r.token === token);
        if (idx !== -1) {
            const { resolve } = this._resolveQueue.splice(idx, 1)[0];
            resolve();
        }
    }

    // 皮卡鱼不支持 Stockfish 的 Skill Level，改用搜索深度控制强度
    setSkillLevel(level) {
        level = Math.max(0, Math.min(20, level | 0));
        if (level <= 3) this.searchDepth = 4;        // 入门
        else if (level <= 7) this.searchDepth = 7;  // 业余
        else if (level <= 11) this.searchDepth = 10;
        else if (level <= 15) this.searchDepth = 14;
        else this.searchDepth = 20;                 // 大师
    }

    setOption(name, value) { this._send(`setoption name ${name} value ${value}`); }
    setMultiPV(n) {
        n = Math.max(1, Math.min(5, n | 0));
        this._multiPV = n;
        this.setOption('MultiPV', n);
    }
    // 详细分析：返回 bestmove、主路线信息、多路线 lines（按 multipv 升序）
    async goDetail(fen, movetime = 1000, opts = {}) {
        if (!this.ready) throw new Error('引擎未就绪');
        const multiPV = opts.multiPV || 1;
        const depth = opts.depth || this.searchDepth;
        if (multiPV !== this._multiPV) this.setMultiPV(multiPV);
        this._bestMove = null;
        this._lastInfo = null;
        this._pvLines = {};
        this._send('ucinewgame');
        this._send(`position fen ${fen}`);
        this._send(`go depth ${depth} movetime ${movetime}`);
        await this._waitFor('bestmove');
        const lines = Object.keys(this._pvLines)
            .map(k => this._pvLines[+k])
            .sort((a, b) => (a.multipv || 1) - (b.multipv || 1));
        const result = { bestmove: this._bestMove, info: this._lastInfo, lines };
        if (this._multiPV !== 1) this.setMultiPV(1); // 复位，避免影响后续对弈搜索
        return result;
    }
    async go(fen, movetime = 1000) {
        const r = await this.goDetail(fen, movetime, { multiPV: 1 });
        return r.bestmove;
    }

    stop() { this._send('stop'); }
    newGame() { this._send('ucinewgame'); }

    quit() {
        if (this.worker) {
            this._send('quit');
            this.worker.terminate();
            this.worker = null;
            this.ready = false;
        }
    }
}

if (typeof window !== 'undefined') {
    window.PikafishEngine = PikafishEngine;
}
