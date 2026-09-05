# 中国象棋 AI 对弈网站

纯前端中国象棋人机对弈网站，AI 引擎（皮卡鱼 Pikafish）通过 WebAssembly 在浏览器本地运行，无需后端服务器，可直接部署到 GitHub Pages / Vercel / Netlify / Cloudflare Pages 等任意静态托管。

## 功能

- 人机对弈，支持红方/黑方选择
- AI 引擎：皮卡鱼 Pikafish（最强开源中国象棋引擎，NNUE 神经网络），单线程 WASM 版本在浏览器本地运行，无需跨源隔离（COOP/COEP），任意静态托管直接可用
- 实时局面评估条（思考中实时更新）
- 5 档难度（入门/业余/进阶/大师/巅峰），皮卡鱼不支持 Skill Level，改用「搜索深度 + 思考时间上限」区分强度
- 悔棋、重新开始
- **中式记谱棋谱**（如炮二平五、马8进7），支持开局/上一步/下一步/回到当前的**复盘**，点棋谱可跳转
- **吃子栏**（被吃棋子按子力排序）与**评估曲线**（整局红黑优劣走势）
- **引擎着法提示**：一键让皮卡鱼给出推荐着法（棋盘绿色箭头）
- **自动存档续盘**：未下完对局存 localStorage，刷新可继续；已结束对局自动入「对局记录」
- 走子/吃子/将军/终局 WebAudio 合成音效（无音频文件，可静音）
- 将死/困毙判定与胜负结算弹窗；走子动画、吃子特效、将军脉冲提示
- **PWA**：带 manifest 与图标，可安装到桌面/主屏幕、离线可玩

### 第二梯队：引擎分析（会“教棋”）
- **着法质量评估**：玩家每步与引擎最佳着对比，按分差标注 最佳 / 正着 / 缓手 / 错着 / 漏着 徽章
- **多路线分析**：复盘或当前局面一键让皮卡鱼 MultiPV 给出前三推荐着法、评分（含杀棋步数）与连续中文变化
- **棋谱导出**：一键生成并复制标准中文棋谱文本，以及当前局面 FEN
- **对局棋钟**：统计双方累计思考用时与当前手数，续盘保留
- 引擎不可用时自动降级为本地 Minimax AI
- 手机/平板自适应布局，触摸即点即走（无 300ms 延迟）
- Service Worker 缓存：首次加载后二次访问秒开，支持离线对弈
- 按设备性能自动调整引擎思考时间

## 技术架构

```
浏览器本地运行，零服务器成本：
┌──────────────────────────────────────┐
│  index.html (棋盘UI + 规则 + 动画)   │
│  pikafish-engine.js (Worker封装)     │
│  sw.js (Service Worker 离线缓存)     │
│         ↓ postMessage（UCI 文本）    │
│  Web Worker                          │
│  ├─ pikafish.js (Emscripten胶水)     │
│  ├─ pikafish.wasm (引擎二进制约500KB)│
│  └─ data/pikafish.data (内置网络4MB) │
└──────────────────────────────────────┘
```

- 前端纯 HTML/CSS/JS，棋盘用 Canvas 绘制
- 皮卡鱼引擎编译为单线程 WASM，在 Web Worker 中运行，不阻塞主线程，且不依赖 SharedArrayBuffer / 跨源隔离
- UCI 协议通信：封装层经 `send_command` 发指令、`read_stdout` 收回信
- NNUE 神经网络已由 Emscripten 打包进 `data/pikafish.data`（约 4MB），引擎启动时自动加载挂载，无需手动传输
- 本地降级 AI：Minimax + Alpha-Beta 剪枝 + 置换表 + 空着裁剪 + 静态搜索
- Service Worker 缓存策略：HTML 网络优先、`.data` 网络包缓存优先（不重复下载）、其余静态资源后台更新

## 本地运行

由于使用了 Web Worker 和 fetch，**不能直接双击 index.html**（`file://` 协议下浏览器会以 origin=null 拒绝创建 Worker，报 `Failed to construct 'Worker'`），必须通过 HTTP 访问。

**Windows 最简单**：双击项目根目录的 `启动本地预览.bat`，会自动起服务器并打开浏览器。

或手动执行：

```bash
# Python 3
cd docs
python -m http.server 8000

# 或 Node.js
npx serve docs
```

然后访问 `http://localhost:8000`

> 注意：Service Worker 需要在 http://localhost 或 HTTPS 下才会注册。

## 部署到公网

所有部署方式的**发布目录都是 `docs/`**。首次访问需下载约 4MB 引擎文件（wasm + 打包网络），之后由浏览器缓存和 Service Worker 接管，二次访问零下载。

### 方式一：GitHub Pages

1. 将代码推送到 GitHub 仓库
2. 仓库 Settings → Pages → Source 选 `Deploy from a branch`
3. Branch 选 `main`，目录选 `/docs`，保存
4. 等待 1-2 分钟，访问 `https://你的用户名.github.io/仓库名/`

> GitHub Pages 自动开启 gzip 与 HTTPS，但不支持自定义缓存头，缓存优化效果不如以下三种平台。

### 方式二：Vercel（推荐）

1. Import 仓库后，**Root Directory 选择 `docs`**
2. Framework Preset 选 Other，无需构建命令，直接 Deploy
3. `docs/vercel.json` 会自动生效（.data/wasm 一年强缓存、HTML 不缓存、安全头）

### 方式三：Netlify

1. 仓库根目录已带 `netlify.toml`（自动指定 publish = "docs"），直接连仓库部署即可
2. 缓存头由 `docs/_headers` 自动生效

### 方式四：Cloudflare Pages（国内访问相对稳定，推荐）

1. Connect Git 仓库，Build command 留空，**Output directory 填 `docs`**
2. `docs/_headers` 自动生效，全球 CDN 分发引擎文件

### 方式五：自建 Nginx

参考 `docs/nginx.conf.example`，要点：

- `.wasm` 的 MIME 必须是 `application/wasm`，否则浏览器拒绝编译（`.data` 用默认 `application/octet-stream` 即可）
- `.data` / `.wasm` / 引擎 js 设 `Cache-Control: public, max-age=31536000, immutable`
- `sw.js` 和 HTML 设 `no-cache`，保证更新即时下发
- 必须 HTTPS（Web Worker / Service Worker 要求安全上下文）
- Nginx 默认支持 Range 请求与 gzip，无需额外配置

## 缓存策略说明（公网体验关键）

| 资源 | 策略 | 原因 |
|------|------|------|
| index.html / sw.js | no-cache，每次校验 | 保证新版本即时下发 |
| data/pikafish.data（约4MB） | immutable 强缓存 + SW CacheFirst | 神经网络包内容不变，避免重复下载 |
| pikafish.wasm / *.js | 强缓存 + SW 后台更新 | 体积小，秒开且最终一致 |

更新了引擎文件后：把 `docs/sw.js` 顶部的 `CACHE_VERSION` 加 1，用户下次打开会自动清理旧缓存。

## 项目结构

```
chess_project/
├── docs/                       # 部署发布目录
│   ├── index.html              # 主页面（棋盘、规则、动画、UI、响应式）
│   ├── sw.js                   # Service Worker（离线缓存）
│   ├── manifest.webmanifest   # PWA 清单（可安装到桌面）
│   ├── icon.svg               # PWA 图标
│   ├── pikafish-engine.js      # 皮卡鱼 WASM 前端封装类
│   ├── worker.js               # Web Worker 入口
│   ├── pikafish.js             # Emscripten JS 胶水（已做浏览器兼容处理）
│   ├── pikafish.wasm           # 皮卡鱼引擎 WASM 二进制（单线程，约500KB）
│   ├── data/
│   │   └── pikafish.data       # 打包的 NNUE 神经网络（约4MB，引擎自动加载）
│   ├── _headers                # Netlify / Cloudflare Pages 缓存头配置
│   ├── vercel.json             # Vercel 缓存头配置
│   └── nginx.conf.example      # 自建 Nginx 配置示例
├── 启动本地预览.bat            # Windows 一键起本地服务器并打开浏览器
├── netlify.toml                # Netlify 发布目录配置
├── Copying.txt                 # GPL 开源协议
└── NNUE-License.md             # NNUE 网络协议说明
```

## 引擎说明

- 当前内置引擎版本为 Pikafish `dev-20240226-98b20a33` 的**单线程 WASM 构建**：免跨源隔离、体积小、启动约 1 秒、开局搜索可达 10 万+ NPS，对网页人机对弈足够。
- 神经网络已通过 Emscripten `--preload-file` 打包进 `data/pikafish.data`，由引擎自动加载，不再需要单独的 49MB `.nnue` 文件。
- 该构建的原始胶水为 Node 环境写法，`pikafish.js` 已做三处浏览器兼容：把顶部 `require('fs')` 改为特性检测、`__dirname` 改为空串兜底、文件读取 `fs.readFile` 在浏览器内用 `fetch` 实现，并将 UMD 末尾的 `module.exports` 改为同时挂载到 `self/globalThis`。**如日后更换引擎构建，需重新做同样处理或直接选用 Web 版构建。**
- 引擎通过 UCI 文本协议工作：握手阶段自动发 `uci`/`isready`，对弈时发 `position fen ...` 与 `go depth N movetime M`（深度与时间任一达到即停）。

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
