@echo off
chcp 65001 >nul
title 停止象棋AI服务
echo 正在停止中国象棋 AI 服务...
taskkill /f /im pythonw.exe 2>nul
taskkill /f /im python.exe 2>nul
echo.
echo 服务已停止
pause
