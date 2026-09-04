@echo off
chcp 65001 >nul
title 中国象棋 AI - 本地预览服务器
rem ============================================================
rem  双击本脚本即可在本机以 http 方式预览网站（不要直接双击 index.html，
rem  浏览器在 file:// 协议下会禁止 Web Worker 加载引擎）。
rem  关闭本黑窗口即停止服务器。
rem ============================================================
cd /d "%~dp0docs"

set PORT=8000
echo.
echo  正在启动本地服务器，稍后会自动打开浏览器...
echo  如未自动打开，请手动访问 http://localhost:%PORT%/
echo  关闭此窗口即可停止服务器。
echo.

rem 2 秒后用默认浏览器打开
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/"

rem 优先 py 启动器，其次 python 命令
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 -m http.server %PORT%
) else (
    python -m http.server %PORT%
)

echo.
echo  服务器已停止，或未检测到 Python。请安装 Python 3 后重试，
echo  或直接把 docs 目录部署到 Vercel / Netlify / GitHub Pages。
pause
