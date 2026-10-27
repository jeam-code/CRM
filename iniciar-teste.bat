@echo off
REM Inicia a versao de teste do Grupo Festa ADM (http://localhost:5173)
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo Iniciando servidor de teste...
start "" "http://localhost:5173"
node "%~dp0node_modules\vite\bin\vite.js" --port 5173 --strictPort
pause
