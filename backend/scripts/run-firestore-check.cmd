@echo off
setlocal

for /f "tokens=5" %%a in ('netstat -ano ^| find ":4100" ^| find "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

start "canopytrove-backend" /b cmd /c npx tsx src/server.ts
ping 127.0.0.1 -n 9 >nul

echo HEALTH
curl http://127.0.0.1:4100/health
echo.

echo SEED
curl -X POST http://127.0.0.1:4100/admin/seed-firestore
echo.

echo BENCHMARK
call npm run benchmark

for /f "tokens=5" %%a in ('netstat -ano ^| find ":4100" ^| find "LISTENING"') do taskkill /PID %%a /F

endlocal
