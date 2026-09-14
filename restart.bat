cd /d "C:\Users\FarmazionSAS\Documents\Default Project\amigo-secreto"
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 >nul
start "" node server.js
timeout /t 2 >nul
echo Server started
