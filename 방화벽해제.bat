@echo off
echo Windows 방화벽 설정을 시작합니다...
echo (이 창이 관리자 권한으로 실행되지 않았다면 실패할 수 있습니다.)

echo.
echo.
echo 1. 포트 5173 (Frontend/Vite V1) 여는 중...
netsh advfirewall firewall add rule name="Railway Dashboard Frontend 5173" dir=in action=allow protocol=TCP localport=5173

echo.
echo 2. 포트 5175 (Frontend/Vite V2) 여는 중...
netsh advfirewall firewall add rule name="Railway Dashboard Frontend 5175" dir=in action=allow protocol=TCP localport=5175

echo.
echo 3. 포트 5174 (Frontend/Vite V3) 여는 중...
netsh advfirewall firewall add rule name="Railway Dashboard Frontend 5174" dir=in action=allow protocol=TCP localport=5174

echo.
echo 4. 포트 3001 (Backend/API) 여는 중...
netsh advfirewall firewall add rule name="Railway Dashboard Backend" dir=in action=allow protocol=TCP localport=3001

echo.
echo 설정이 완료되었습니다!
pause
