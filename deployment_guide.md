# Render.com 배포 가이드 (완전 정복)

현재 **Git이 설치되어 있지 않거나 프로젝트가 GitHub에 없습니다.**
아래 0단계부터 차근차근 따라오시면 됩니다.

## 0단계: Git 설치하기 (필수)
컴퓨터에 Git이 없으면 GitHub에 코드를 올릴 수 없습니다.
1.  [Git 다운로드 페이지(클릭)](https://git-scm.com/download/win)로 이동합니다.
2.  **"Click here to download"**를 눌러 설치 파일을 받습니다.
3.  설치 파일을 실행하고, **계속 Next만 눌러서 설치를 완료**합니다.
4.  **중요**: 설치가 끝나면 **현재 보고 계신 이 프로그램(VS Code)을 껐다가 다시 켜주세요.** (그래야 Git을 인식합니다)
5.  터미널에 `git --version`을 쳤을 때 버전 숫자가 나오면 성공입니다.

## 1단계: GitHub 저장소(Repository) 만들기
1.  [GitHub 웹사이트](https://github.com/)에 로그인합니다.
2.  오른쪽 위의 **+** 버튼 -> **New repository**를 누릅니다.
3.  **Repository name**에 `railway-dashboard` 라고 적습니다.
4.  **Public** (공개) 또는 **Private** (비공개) 중 원하는 것을 선택합니다.
5.  다른 건 건드리지 말고 맨 아래 **Create repository** 초록색 버튼을 누릅니다.
6.  화면이 바뀌면 `https://github.com/내아이디/railway-dashboard.git` 같은 주소가 보일 겁니다. 이 주소를 복사해두세요.

## 2단계: 내 컴퓨터의 코드를 GitHub로 보내기
VS Code의 터미널(Ctrl + `)을 열고 아래 명령어를 **한 줄씩** 입력하세요.
(혹시 이메일/이름을 물어보면 화면에 나오는 대로 입력하면 됩니다)

```bash
# 1. Git 초기화 (처음 한 번만)
git init

# 2. 모든 파일 담기
git add .

# 3. 설명 적어서 포장하기
git commit -m "Render 배포를 위한 준비"

# 4. GitHub 저장소와 연결하기 (주소는 아까 복사한 걸로 바꾸세요!)
# 예: git remote add origin https://github.com/Start-Something/railway-dashboard.git
git remote add origin [여기에_아까_복사한_주소_붙여넣기]

# 5. GitHub로 발사!
git push -u origin main
```
*주의: `main`이 없다고 에러가 나면 `git push -u origin master`로 해보세요.*

## 3단계: Render 서비스 생성
이제 코드가 GitHub에 올라갔으니 Render에서 가져올 수 있습니다.
1.  [Render.com Dashboard](https://dashboard.render.com/) 접속.
2.  **New +** -> **Web Service**.
3.  **Build and deploy from a Git repository** -> Next.
4.  방금 올린 `railway-dashboard`가 목록에 보일 겁니다. **Connect** 클릭.

## 4단계: 설정 입력 (그대로 따라하세요)

| 항목 | 입력값 |
| :--- | :--- |
| **Name** | `railway-dashboard` |
| **Region** | `Singapore` |
| **Branch** | `main` (또는 master) |
| **Root Directory** | `.` (점 하나) |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node server/custom-server.js` |
| **Instance Type** | **Free** |

## 5단계: 환경 변수 등록 (비밀키)
화면 아래 **Environment Variables** -> **Add Environment Variable** 클릭.

1.  **GOOGLE_SHEET_ID**
    - 값: `1WHwcJX5nrpZlDKTt9_nMMl3h9-W9gdipcVce23PReno`
2.  **GOOGLE_SERVICE_ACCOUNT_JSON**
    - 값: `d:\ ... \server\credentials.json` 파일을 메모장으로 열어서 **내용 전체**를 복사해 붙여넣기.

## 6단계: 배포 시작
**Create Web Service** 클릭! 3~5분 뒤 성공(Live)하면 끝입니다.
