import os
import subprocess
import threading
import time
import webbrowser
from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static', static_url_path='')


class PikafishEngine:
    """通过 UCI 协议与皮卡鱼引擎通信"""

    def __init__(self, exe_path):
        self.process = subprocess.Popen(
            [exe_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            encoding='utf-8',
            errors='replace',
        )
        self._init_uci()

    def _send(self, cmd):
        self.process.stdin.write(cmd + '\n')
        self.process.stdin.flush()

    def _read_line(self):
        return self.process.stdout.readline().strip()

    def _init_uci(self):
        self._send('uci')
        while True:
            if self._read_line() == 'uciok':
                break
        self._send('isready')
        while True:
            if self._read_line() == 'readyok':
                break

    def go(self, fen, movetime=2000):
        """返回 (bestmove, score)，score 为当前走子方视角"""
        self._send('ucinewgame')
        self._send(f'position fen {fen}')
        self._send(f'go movetime {movetime}')

        bestmove = None
        score = None
        while True:
            line = self._read_line()
            if line.startswith('info') and 'score' in line:
                parts = line.split()
                for i, p in enumerate(parts):
                    if p == 'score' and i + 2 < len(parts):
                        if parts[i + 1] == 'cp':
                            score = int(parts[i + 2])
                        elif parts[i + 1] == 'mate':
                            m = int(parts[i + 2])
                            score = 10000 - m if m > 0 else -10000 - m
            if line.startswith('bestmove'):
                parts = line.split()
                if len(parts) >= 2:
                    bestmove = parts[1]
                break
        return bestmove, score

    def quit(self):
        try:
            self._send('quit')
            self.process.wait(timeout=3)
        except Exception:
            self.process.kill()


def find_pikafish():
    """在项目目录中查找皮卡鱼 exe"""
    base = os.path.dirname(os.path.abspath(__file__))
    for root, _dirs, files in os.walk(base):
        for f in files:
            if f.lower().endswith('.exe') and 'pikafish' in f.lower():
                # 优先选通用版，避免 avx512 等不兼容版本
                path = os.path.join(root, f)
                name_lower = f.lower()
                if 'avx512' in name_lower or 'vnni512' in name_lower:
                    continue
                return path
    # 退而求其次
    for root, _dirs, files in os.walk(base):
        for f in files:
            if f.lower().endswith('.exe') and 'pikafish' in f.lower():
                return os.path.join(root, f)
    return None


engine = None
engine_path = find_pikafish()
if engine_path:
    try:
        engine = PikafishEngine(engine_path)
        print(f'[OK] 皮卡鱼引擎已启动: {engine_path}')
    except Exception as e:
        print(f'[WARN] 启动皮卡鱼失败: {e}，将使用本地AI')
        engine = None
else:
    print('[WARN] 未找到皮卡鱼引擎，将使用本地AI')


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/ai_move', methods=['POST'])
def api_ai_move():
    if engine is None:
        return jsonify({'error': 'engine not available'}), 503
    data = request.json or {}
    fen = data.get('fen', '')
    movetime = int(data.get('movetime', 2000))
    if not fen:
        return jsonify({'error': 'fen required'}), 400
    try:
        bestmove, score = engine.go(fen, movetime)
        return jsonify({'bestmove': bestmove, 'score': score})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/engine_status')
def engine_status():
    return jsonify({'available': engine is not None, 'path': engine_path})


if __name__ == '__main__':
    def _open_browser():
        time.sleep(1.5)
        webbrowser.open('http://127.0.0.1:5000')
    threading.Thread(target=_open_browser, daemon=True).start()
    app.run(host='127.0.0.1', port=5000, debug=False)
