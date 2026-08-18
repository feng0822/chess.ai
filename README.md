# 中国象棋 AI 对弈网站

基于 Flask + 皮卡鱼（Pikafish）引擎的中国象棋人机对弈网站，支持实时局面评估。

## 功能

- 🎮 人机对弈，红方（玩家）先行
- 🤖 AI 引擎：[皮卡鱼 Pikafish 2026-01-02](https://github.com/official-pikafish/Pikafish)（目前最强开源中国象棋引擎，NNUE 神经网络）
- 📊 实时局面评估条（评分来自皮卡鱼引擎，与天天象棋同量级）
- ⚙️ 三档难度（简单/中等/困难），控制引擎思考时间
- ↩️ 悔棋、重新开始
- 🛡️ 长将检测（避免 AI 循环将军耍赖）
- 🔄 引擎不可用时自动降级为本地 Minimax AI

## 快速开始

### 环境要求

- Python 3.8+
- Windows（引擎为 Windows 版 exe）

### 安装依赖

```bash
pip install flask
```

### 启动

双击 `启动象棋.bat`，服务启动后会自动打开浏览器。

或手动运行：

```bash
python app.py
```

然后访问 `http://127.0.0.1:5000`

### 无窗口启动

双击 `启动象棋(无窗口).vbs`，后台静默运行。关闭用 `停止服务.bat`。

## 项目结构

```
chess_project/
├── app.py                  # Flask 后端，UCI 协议调用皮卡鱼引擎
├── 启动象棋.bat             # 双击启动（有窗口）
├── 启动象棋(无窗口).vbs     # 双击启动（后台无窗口）
├── 停止服务.bat             # 停止后台服务
├── requirements.txt        # Python 依赖
├── pikafish.nnue           # 皮卡鱼神经网络权重文件
├── Windows/                # 皮卡鱼引擎（多 CPU 指令集版本）
│   ├── pikafish-avx2.exe
│   ├── pikafish-bmi2.exe
│   └── ...
└── static/
    └── index.html          # 前端（棋盘、规则、AI 调用、评估条）
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

## 技术说明

- 前端纯 HTML/CSS/JS，棋盘用 Canvas 绘制
- 后端通过 subprocess 启动皮卡鱼引擎，UCI 协议通信
- 局面用 FEN 格式传递，引擎返回 bestmove 和 score
- 本地降级 AI：Minimax + Alpha-Beta 剪枝 + 置换表 + 空着裁剪 + 静态搜索

## 部署到公网（Render 免费套餐）

项目已包含 `render.yaml`，可一键部署到 Render：

1. 将代码推送到 GitHub 仓库
2. 打开 https://dashboard.render.com ，选 **New → Web Service**
3. 连接你的 GitHub 仓库
4. Render 会自动读取 `render.yaml`，点击 **Apply**
5. 部署完成后访问 `https://你的服务名.onrender.com` 即可在线对战

> Render 免费套餐冷启动需 30-60 秒，15 分钟无请求会休眠（下次访问自动唤醒）。
> 皮卡鱼引擎使用 Linux 版二进制（`Linux/` 目录），已随仓库提交。

## License

GPL-3.0（皮卡鱼引擎采用 GPL-3.0）
