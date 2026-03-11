@echo off
chcp 65001
echo ==============================================
echo 배포용 빌드(dist)를 미리보기 실행합니다.
echo 잠시 후 브라우저가 열립니다. (주소: http://localhost:4173)
echo ==============================================

start http://localhost:4173
npm run preview
pause
