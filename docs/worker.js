// Worker 入口：加载 pikafish.js 并启动模块化的 PikafishModule
try {
    importScripts('pikafish.js');
    PikafishModule();
} catch (e) {
    postMessage({ type: 'worker_error', data: String(e) });
}
