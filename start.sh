#!/bin/bash

echo "============================================"
echo "       MineDDoS Bot Panel - Launch"
echo "============================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js: https://nodejs.org/"
    echo ""
    exit 1
fi

echo "[*] Node.js found"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$DIR/node_modules" ]; then
    echo "[*] Installing dependencies..."
    cd "$DIR"
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to install dependencies."
        exit 1
    fi
    echo "[OK] Dependencies installed."
    echo ""
fi

cd "$DIR"
echo "[*] Starting panel..."
echo ""
node start.js