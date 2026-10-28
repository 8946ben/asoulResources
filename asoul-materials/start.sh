#!/usr/bin/env bash
# A-SOUL 素材站 · 本地启动脚本
cd "$(dirname "$0")"
PORT="${1:-8080}"
echo "──────────────────────────────────────────"
echo "  A-SOUL 素材站"
echo "  已启动本地服务： http://localhost:${PORT}/"
echo "  按 Ctrl + C 停止"
echo "──────────────────────────────────────────"
python3 -m http.server "$PORT" --bind 127.0.0.1
