// Worker 入口：加载皮卡鱼 WASM 引擎（单线程构建，无需跨源隔离）
// 神经网络已打包进 data/pikafish.data，由引擎自动加载，无需主线程传输
let engine = null;

try {
    importScripts('pikafish.js');

    Pikafish({
        // .data 网络包在 data/ 子目录，wasm/js 与本 worker 同目录
        locateFile: (f) => (f === 'pikafish.data' ? 'data/' + f : f),
        setStatus: (text) => postMessage({ type: 'status', data: String(text) }),
        printErr: (text) => postMessage({ type: 'stderr', data: String(text) }),
    }).then((mod) => {
        engine = mod;
        // 引擎输出按行回传主线程
        engine.read_stdout = (line) => postMessage({ type: 'stdout', data: line });
        // 启动 UCI 握手
        engine.send_command('uci');
    }).catch((err) => {
        postMessage({ type: 'worker_error', data: String(err && err.stack || err) });
    });

    // 主线程发来的 UCI 命令（纯字符串）转发给引擎
    self.onmessage = (e) => {
        const cmd = e.data;
        if (typeof cmd === 'string' && engine) engine.send_command(cmd);
    };
} catch (e) {
    postMessage({ type: 'worker_error', data: String(e && e.stack || e) });
}
