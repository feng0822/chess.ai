/**
 * PikafishEngine - 皮卡鱼 WASM 前端封装
 * AI 运算全部在浏览器本地 Worker 中执行，无需后端服务器
 */
class PikafishEngine {
    constructor(options = {}) {
        this.worker = null;
        this.ready = false;
        this.nnueUrl = options.nnueUrl || 'pikafish.nnue';
        this.wasmUrl = options.wasmUrl || 'worker.js';
        this.onInfo = options.onInfo || null;
        this.onBestMove = options.onBestMove || null;
        this.onProgress = options.onProgress || null; // 进度回调
        this._uciReady = false;
        this._resolveQueue = [];
        this._bestMove = null;
        this._infoBuffer = [];
    }

    _progress(text) {
        console.log('[Pikafish]', text);
        if (this.onProgress) this.onProgress(text);
    }

    async init() {
        return new Promise((resolve, reject) => {
            this._progress('创建 Worker...');
            this.worker = new Worker(this.wasmUrl);

            // 超时：NNUE 49MB 可能下载较慢，给 5 分钟
            const timeout = setTimeout(() => {
                reject(new Error('初始化超时（请检查网络，NNUE 49MB 下载可能较慢）'));
            }, 300000);

            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'module_ready') {
                    this._progress('WASM 初始化完成，开始下载 NNUE...');
                    this._loadNnue();
                } else if (msg.type === 'nnue_loaded') {
                    this._progress('NNUE 加载完成，引擎启动中...');
                    this._send('uci');
                } else if (msg.type === 'worker_error') {
                    clearTimeout(timeout);
                    reject(new Error('Worker内部错误: ' + msg.data));
                } else if (msg.type === 'stdout') {
                    this._handleStdout(msg.data);
                } else if (msg.type === 'stderr') {
                    console.warn('[Pikafish stderr]', msg.data);
                }
            };

            this.worker.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error('Worker错误: ' + err.message + ' (文件名:' + err.filename + ':' + err.lineno + ')'));
            };

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

    async _loadNnue() {
        try {
            const resp = await fetch(this.nnueUrl);
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const total = resp.headers.get('content-length');
            let loaded = 0;
            const reader = resp.body.getReader();
            const chunks = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                if (total) {
                    const pct = Math.round(loaded / total * 100);
                    const mb = (loaded / 1048576).toFixed(1);
                    const totalMb = (total / 1048576).toFixed(0);
                    this._progress(`下载 NNUE: ${mb}/${totalMb}MB (${pct}%)`);
                } else {
                    const mb = (loaded / 1048576).toFixed(1);
                    this._progress(`下载 NNUE: ${mb}MB...`);
                }
            }
            const buffer = new Uint8Array(loaded);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }
            this._progress('NNUE 下载完成，发送给引擎...');
            this.worker.postMessage({ type: 'nnue', data: buffer.buffer }, [buffer.buffer]);
        } catch (e) {
            console.error('NNUE加载失败:', e);
            throw e;
        }
    }

    _handleStdout(line) {
        if (!line) return;
        if (line.startsWith('info') && this.onInfo) {
            this.onInfo(this._parseInfo(line));
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
            if (parts[i] === 'score' && parts[i+1] && parts[i+2]) {
                info.scoreType = parts[i+1];
                info.score = parseInt(parts[i+2]);
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

    setSkillLevel(level) {
        level = Math.max(0, Math.min(20, level));
        this._send(`setoption name Skill Level value ${level}`);
    }

    async go(fen, movetime = 1000) {
        if (!this.ready) throw new Error('引擎未就绪');
        this._bestMove = null;
        this._send('ucinewgame');
        this._send(`position fen ${fen}`);
        this._send(`go movetime ${movetime}`);
        await this._waitFor('bestmove');
        return this._bestMove;
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
