@echo off
chcp 65001 >nul
title MineDDoS Bot Panel

echo ============================================
echo        MineDDoS Bot Panel - Запуск
echo ============================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ОШИБКА] Node.js не найден. Установи Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [*] Node.js найден
echo.

if not exist "%~dp0node_modules" (
    echo [*] Установка зависимостей...
    cd /d "%~dp0"
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo [ОШИБКА] Не удалось установить зависимости.
        pause
        exit /b 1
    )
    echo [OK] Зависимости установлены.
    echo.
)

cd /d "%~dp0"
echo [*] Запуск панели...
echo.
node start.js

echo.
pause