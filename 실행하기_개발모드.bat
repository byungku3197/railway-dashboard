@echo off
chcp 65001
echo ==============================================
echo 철도2부 수금/지출 대쉬보드 (V2)를 실행합니다.
echo 잠시 후 브라우저가 열립니다. (주소: http://localhost:5175)
echo 실행을 종료하려면 이 창을 닫거나 Ctrl+C를 누르세요.
echo ==============================================

echo 서버 시작 중...
start "Railway Server" /MIN node server/custom-server.js

echo 프론트엔드 시작 중...
start http://localhost:5175
npm run dev:v2
pause
