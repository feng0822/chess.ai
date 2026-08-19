# 中国象棋 AI 对弈网站

纯前端中国象棋人机对弈网站，AI 引擎（皮卡鱼 Pikafish）通过 WebAssembly 在浏览器本地运行，无需后端服务器，可直接部署到 GitHub Pages。

## 功能

- 人机对弈，支持红方/黑方选择
- AI 引擎：皮卡鱼 Pikafish（最强开源中国象棋引擎，NNUE 神经网络），WASM 版本在浏览器本地运行
- 实时局面评估条（思考中实时更新）
- 5 档难度（入门/业余/进阶/大师/巅峰），基于 Skill Level 全平台统一
- 悔棋、重新开始
- 走子动画、吃子特效、将军脉冲提示
- 引擎不可用时自动降级为本地 Minimax AI

## 技术架构

```
浏览器本地运行，零服务器成本：
┌─────────────────────────────────────┐
│  index.html (棋盘UI + 规则 + 动画)  │
│  pikafish-engine.js (Worker封装)    │
│         ↓ postMessage               │
│  Web Worker                         │
│  ├─ pikafish.js (Emscripten胶水)    │
│  ├─ pikafish.wasm (引擎二进制660KB) │
│  └─ pikafish.nnue (神经网络49MB)    │
└─────────────────────────────────────┘
```

- 前端纯 HTML/CSS/JS，棋盘用 Canvas 绘制
- 皮卡鱼引擎编译为 WASM，在 Web Worker 中运行，不阻塞主线程
- UCI 协议通信，通过 stdin/stdout 与引擎交互
- NNUE 神经网络文件运行时加载到 WASM 虚拟文件系统
- 本地降级 AI：Minimax + Alpha-Beta 剪枝

## 本地运行

由于使用了 Web Worker 和 fetch，需要通过 HTTP 服务器访问（不能直接双击打开 HTML）：

```bash
# Python 3
cd docs
python -m http.server 8000

# 或 Node.js
npx serve docs
```

然后访问 `http://localhost:8000`

## 部署到 GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/docs`，保存
4. 等待 1-2 分钟，访问 `https://你的用户名.github.io/仓库名/`

> 首次加载需下载约 50MB 的 NNUE 神经网络文件，建议在 WiFi 环境下访问。

## 项目结构

```
chess_project/
├── docs/                    # GitHub Pages 部署目录
│   ├── index.html           # 主页面（棋盘、规则、动画、UI）
│   ├── pikafish-engine.js   # 皮卡鱼 WASM 前端封装类
│   ├── pikafish.js          # Emscripten 生成的 JS 胶水代码
│   ├── pikafish.wasm        # 皮卡鱼引擎 WASM 二进制
│   └── pikafish.nnue        # NNUE 神经网络权重文件
├── Copying.txt              # GPL 开源协议
└── NNUE-License.md          # NNUE 网络协议说明
```

## 评分标准

与天天象棋一致：

| 分数 | 含义 |
|------|------|
| 1000 | 多一个车 |
| 500 | 多一个马/炮 |
| 200 | 多一个过河兵 |
| 100 | 多一个未过河兵 |
| < 50 | 计算误差，可忽略 |

## License

GPL-3.0（皮卡鱼引擎采用 GPL-3.0）
