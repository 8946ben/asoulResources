@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ------------------------------------------
echo   A-SOUL 素材站
echo   已启动本地服务： http://localhost:8080/
echo   关闭此窗口即可停止
echo ------------------------------------------
start "" http://localhost:8080/
python -m http.server 8080 --bind 127.0.0.1
