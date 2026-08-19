/**
 * PikafishEngine - 皮卡鱼 WASM 前端封装
 * AI 运算全部在浏览器本地 Worker 中执行，无需后端服务器
 *
 * 使用方法：
 *   const engine = new PikafishEngine();
 *   await engine.init();
 *   engine.setSkillLevel(10);
 *   const move = await engine.go(fen, 1000); // 思考1秒
 *   engine.stop();
 */
class PikafishEngine {
    constructor(options = {}) {
        this.worker = null;
        this.ready = false;
        this.nnueUrl = options.nnueUrl || 'pikafish.nnue';
        this.wasmUrl = options.wasmUrl || 'worker.js';
        this.onInfo = options.onInfo || null;      // info 行回调
        this.onBestMove = options.onBestMove || null; // bestmove 回调
        this._uciReady = false;
        this._resolveQueue = [];  // 等待特定输出的 Promise
        this._bestMove = null;
        this._infoBuffer = [];
    }

    /**
     * 初始化引擎：创建Worker → 加载NNUE → UCI握手
     */
    async init() {
        return new Promise((resolve, reject) => {
            this.worker = new Worker(this.wasmUrl);

            // 超时保护（NNUE 49MB，给足下载时间）
            const timeout = setTimeout(() => {
                reject(new Error('引擎初始化超时（可能是WASM或NNUE加载失败）'));
            }, 120000);

            this.worker.onmessage = (e) => {
                const msg = e.data;
                if (msg.type === 'module_ready') {
                    // WASM模块就绪，开始加载NNUE
                    this._loadNnue();
                } else if (msg.type === 'nnue_loaded') {
                    // NNUE加载完成，发送UCI初始化命令
                    this._send('uci');
                } else if (msg.type === 'stdout') {
                    this._handleStdout(msg.data);
                } else if (msg.type === 'stderr') {
                    console.warn('[Pikafish stderr]', msg.data);
                }
            };

            this.worker.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error('Worker错误: ' + err.message));
            };

            // 等待 uciok + readyok
            this._waitFor('uciok').then(() => {
                this._uciReady = true;
                this._send('isready');
                return this._waitFor('readyok');
            }).then(() => {
                this.ready = true;
                clearTimeout(timeout);
                resolve();
            }).catch(reject);
        });
    }

    /**
     * 加载NNUE文件并发送给Worker
     */
    async _loadNnue() {
        try {
            const resp = await fetch(this.nnueUrl);
            const buffer = await resp.arrayBuffer();
            this.worker.postMessage({ type: 'nnue', data: buffer }, [buffer]);
        } catch (e) {
            console.error('NNUE加载失败:', e);
        }
    }

    /**
     * 处理Worker返回的stdout行
     */
    _handleStdout(line) {
        if (!line) return;

        // 触发 info 回调
        if (line.startsWith('info') && this.onInfo) {
            this.onInfo(this._parseInfo(line));
        }

        // bestmove
        if (line.startsWith('bestmove')) {
            const parts = line.split(/\s+/);
            this._bestMove = parts[1] || null;
            if (this.onBestMove) this.onBestMove(this._bestMove);
            this._resolveWaiting('bestmove');
        }

        // uciok / readyok
        if (line === 'uciok') this._resolveWaiting('uciok');
        if (line === 'readyok') this._resolveWaiting('readyok');
    }

    /**
     * 解析 info 行，提取深度、分数、PV等
     */
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
            if (parts[i] === 'pv') {
                info.pv = parts.slice(i+1);
            }
        }
        return info;
    }

    /**
     * 发送命令给引擎
     */
    _send(cmd) {
        if (this.worker) this.worker.postMessage(cmd);
    }

    /**
     * 等待特定输出标记
     */
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

    /**
     * 设置技能等级（0-20），替代固定深度，全平台难度统一
     */
    setSkillLevel(level) {
        level = Math.max(0, Math.min(20, level));
        this._send(`setoption name Skill Level value ${level}`);
    }

    /**
     * 设置思考时间（毫秒）
     */
    async go(fen, movetime = 1000) {
        if (!this.ready) throw new Error('引擎未就绪');
        this._bestMove = null;
        this._send('ucinewgame');
        this._send(`position fen ${fen}`);
        this._send(`go movetime ${movetime}`);
        await this._waitFor('bestmove');
        return this._bestMove;
    }

    /**
     * 停止思考
     */
    stop() {
        this._send('stop');
    }

    /**
     * 新对局
     */
    newGame() {
        this._send('ucinewgame');
    }

    /**
     * 终止引擎，释放Worker
     */
    quit() {
        if (this.worker) {
            this._send('quit');
            this.worker.terminate();
            this.worker = null;
            this.ready = false;
        }
    }
}

// 导出到全局
if (typeof window !== 'undefined') {
    window.PikafishEngine = PikafishEngine;
}
