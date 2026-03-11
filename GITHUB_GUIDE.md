# GitHub 사용 가이드 (초보자를 위한 상세 설명)

이 가이드는 현재 작업 중인 `railway-dashboard` 프로젝트를 **GitHub**를 이용해 여러 컴퓨터에서 동기화하며 작업하는 방법을 설명합니다.

---

## 🏗️ 1. 준비 작업 (최초 1회 설정)

이미 현재 컴퓨터에는 설정이 되어 있지만, **새로운 컴퓨터**에서 작업을 시작하려면 다음 프로그램들이 설치되어 있어야 합니다.

1.  **Git 설치**: [https://git-scm.com/](https://git-scm.com/) 에서 다운로드 및 설치
2.  **VS Code 설치**: [https://code.visualstudio.com/](https://code.visualstudio.com/) 에서 다운로드 및 설치
3.  **Node.js 설치**: [https://nodejs.org/](https://nodejs.org/) (LTS 버전 추천)

---

## 📤 2. 현재 컴퓨터에서 작업 내용 저장하기 (Push)

작업을 마치고 다른 컴퓨터로 이동하기 전에, 현재 변경 사항을 GitHub 서버에 **올리는(Push)** 과정입니다.

1.  **VS Code**에서 터미널을 엽니다 (`Ctrl` + `~`).
2.  다음 명령어들을 순서대로 입력합니다.

```bash
# 1. 변경된 모든 파일 선택
git add .

# 2. 변경 내용에 이름표 붙여서 저장 (메시지는 자유롭게 작성)
git commit -m "작업 내용 저장: 수금 페이지 완료"

# 3. GitHub 서버로 전송 (로그인 창이 뜨면 로그인해 주세요)
git push
```

> **Tip**: 만약 `git push` 할 때 오류가 난다면, 다른 곳에서 수정된 내용이 있어서 그럴 수 있습니다. 그럴 땐 `git pull`을 먼저 하고 다시 시도하세요.

---

## 📥 3. 다른 컴퓨터에서 작업 내용 가져오기 (Pull)

이제 다른 컴퓨터에 앉아서 이어서 작업을 시작할 때입니다.

### 상황 A: 처음 세팅하는 경우 (폴더가 없는 경우)
바탕화면이나 원하는 폴더에서 터미널(또는 Git Bash)을 열고:

```bash
# 프로젝트 전체를 복사해옵니다. (최초 1회만)
git clone https://github.com/Bluehair999/railway-dashboard.git

# 폴더 안으로 들어갑니다.
cd railway-dashboard

# 필요한 프로그램들을 설치합니다. (이것도 최초 1회만, 혹은 패키지가 바뀔 때)
npm install

# 실행합니다.
npm run dev
```

### 상황 B: 이미 작업하던 폴더가 있는 경우
VS Code로 해당 폴더를 열고 터미널에서:

```bash
# 서버에 있는 최신 내용을 내 컴퓨터로 가져옵니다.
git pull

# (가져온 후) 실행합니다.
npm run dev
```

---

## ⚠️ 주의사항

1.  **"충돌(Conflict)"**: 만약 두 컴퓨터에서 **같은 파일의 같은 줄**을 수정했다면, `git pull` 할 때 충돌이 발생할 수 있습니다. VS Code에서 "Accept Current Change(내꺼 유지)" 또는 "Accept Incoming Change(서버꺼 유지)"를 선택해서 해결해야 합니다.
2.  **`node_modules` 폴더**: 이 폴더는 Git에 올라가지 않습니다. 그래서 새 컴퓨터에서는 반드시 `npm install`을 한 번 해줘야 실행됩니다.
3.  **`.env` 파일 (환경 변수)**: 보안상 중요한 파일이라 Git에 올라가지 않을 수 있습니다.
    *   새 컴퓨터에서 `npm run dev` 했는데 에러가 난다면, 기존 컴퓨터의 `.env` 내용을 복사해서 새 컴퓨터에 파일을 직접 만들어주세요.

---

## 요약

*   **집 갈 때**: `git add .` -> `git commit -m "메시지"` -> `git push`
*   **출근해서**: `git pull` -> `npm run dev`
