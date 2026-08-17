@echo off
chcp 65001 >nul
title 中国象棋 AI 服务
cd /d "%~dp0"
echo ========================================
echo   中国象棋 AI 服务启动中...
echo   引擎：皮卡鱼 Pikafish 2026-01-02
echo ========================================
echo.
echo 服务启动后会自动打开浏览器
echo 要玩游戏请不要关闭此窗口
echo 关闭此窗口即停止 AI 服务
echo.
python app.py
pause
