# 세션 운영 설명서 (초보자용)

이 문서는 **무엇을, 어디서, 어떤 순서로, 무슨 말을 붙여 넣어** 일을 시키는지 적은 설명서다. 설계는 `PLAN.md`, 주의 사항은 `CAUTIONS.md`에 있다.
용어: **세션** = Claude Code 창 하나. **브리프** = 세션 시작할 때 붙여 넣는 지시문. **끝 기준** = 그 세션이 끝났다고 말해도 되는 조건.

## 0. 세 가지 일터와 세 가지 지갑

| 일터 | 어떻게 여나 | 어느 지갑 | 무엇에 쓰나 |
|---|---|---|---|
| **데스크톱 앱**(지금 이 창) | Claude 데스크톱 → Code 탭 → 폴더 `E:/Prodev/Helper` | 구독(Max 또는 Pro) | 총괄(반장), 내장 브라우저로 나라장터 보기, 설치·실측 |
| **터미널** | PowerShell에서 API 키 넣고 `claude` | 콘솔 조직 크레딧 | 설계, 확장 구현, 밤 배치, 리뷰 봇 |
| **클라우드** | claude.ai/code → 클라우드 세션 시작 → 저장소 선택 | 클라우드 세션 크레딧(소진 뒤 구독) | 화면 없이 되는 순수 코드. 2~3개 동시 |

터미널 여는 법(한 번 익히면 끝):
```
$env:ANTHROPIC_API_KEY = "sk-ant-여기에키"
claude
```
창이 뜨면 `/status`를 쳐서 로그인 방식이 API 키인지 본다. 아니면 구독으로 과금되는 중이다. 이 창을 닫으면 다른 창에 영향이 없다.
클라우드는 저장소가 GitHub에 있어야 한다(비공개 저장소로). 잔액은 claude.ai → Settings → Usage.

## 1. 딱 한 번 하는 준비 — 2026-10-28에 실제로 한 대로

아래는 이미 **끝난 일**이다. 다시 할 필요는 없고, 다른 PC나 새 프로젝트에서 같은 준비를 할 때 그대로 따라 하면 된다. 모든 명령은 PowerShell에서 `E:\Prodev\Helper` 안에서 실행한다.

### 1-1. 옛 북마클릿을 치운다 (사용자가 함)
루트에 있던 `g2b-toolbox-v4.2.js`와 `g2b_*.txt` 7개를 `carryover/reference/`로 옮겼다. 루트에 코드처럼 보이는 파일이 없어야 새 세션이 그것을 제품 코드로 착각하지 않는다.
확인: `ls carryover/reference` 에 8개 파일이 보이면 된다.

### 1-2. 규칙 파일 두 개 (사용자가 함)
- `AGENTS.md`: PLAN.md 6.7절 내용을 그대로 복사해 루트에 저장. 28줄.
- `CLAUDE.md`: 내용은 `@AGENTS.md` 한 줄. Claude Code는 CLAUDE.md를 읽고, 그 한 줄이 AGENTS.md를 불러온다. Codex는 AGENTS.md를 바로 읽는다.
확인: `Get-Content CLAUDE.md` 가 `@AGENTS.md` 한 줄이면 된다.

### 1-3. docs 폴더 세 파일 (사용자가 만들고, PROCESS.md는 Claude가 채움)
- `docs/SPEC.md`: 빈 파일. 설계 세션 S1이 채운다.
- `docs/DECISIONS.md`: 첫 줄 `2026-10-28 새 저장소 시작. 옛 G2B_Helper는 참고용 동결.`
- `docs/PROCESS.md`: 이 문서 2절을 **에이전트에게 말하는 꼴**로 바꾼 것. 시작할 때·일하는 중·끝낼 때·가지와 PR·검증 명령 다섯 절.

### 1-4. .gitignore (Claude가 함)
Git에 올리지 않을 것을 적는 파일. 루트에 `.gitignore`라는 이름으로 아래 12줄을 넣었다.
```
node_modules/
.venv/
__pycache__/
*.pyc
*.sqlite3
*.sqlite3-wal
*.sqlite3-shm
dist/
docs/feasibility-values/
.omc/
.DS_Store
Thumbs.db
```
뜻: 설치되는 라이브러리(node_modules, .venv), 파이썬 캐시, SQLite 자료 파일, 빌드 결과(dist), 실제 값이 들어갈 수 있는 폴더(feasibility-values), 도구 상태 폴더(.omc)는 저장소에 넣지 않는다.

### 1-5. README.md (Claude가 함)
저장소를 처음 여는 사람(클라우드 세션 포함)이 어느 파일부터 볼지 적은 짧은 안내. 규칙·절차·사양·결정·방향·운영·주의·carryover의 위치만 적었다.

### 1-6. 이 폴더의 Claude Code 설정 (Claude가 함)
`.claude/settings.json`을 만들었다. 두 가지를 정한다.
```
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true,
    "mattpocock-skills@claude-plugins-official": true,
    "oh-my-claudecode@omc": false,
    "ponytail@ponytail": false
  },
  "permissions": {
    "deny": [ "Edit(carryover/**)", "Write(carryover/**)" ]
  }
}
```
- `enabledPlugins`: 이 폴더에서 superpowers와 mattpocock-skills는 켜고, oh-my-claudecode와 ponytail은 끈다. 플러그인 ID는 터미널에서 `claude plugin list`로 확인한 실제 이름이다. mattpocock은 켜 두되 grilling만 S1에서 수동으로 부른다.
- `permissions.deny`: carryover 폴더는 어떤 세션도 고치지 못한다. 가져온 원본을 보존하기 위해서다.
- 이 파일은 저장소에 함께 올라가므로 클라우드 세션에도 같은 설정이 적용된다. **적용 확인은 새 세션을 열어 `/plugins` 또는 스킬 목록에 OMC가 없는지 보는 것**이다(아직 확인하지 않음).

### 1-7. git 저장소 만들기와 첫 커밋 (Claude가 함)
```
git init -b main
git config user.name "1231"
git config user.email "slomae77@gmail.com"
git add .
git commit -m "chore: 새 시작, carryover와 계획 문서"
```
- `git init -b main`: 이 폴더를 저장소로 만들고 기본 가지 이름을 main으로.
- `git config user.name/email`(--global 없이): **이 저장소에서만** 쓰는 이름과 메일. 옛 저장소와 같은 값을 썼다. 전역 설정은 건드리지 않았다.
- `git add .` → `git commit`: 45개 파일이 첫 커밋 `f6519dc`가 됐다.
- "LF will be replaced by CRLF" 경고는 Windows 줄바꿈 변환 안내일 뿐 오류가 아니다.
확인: `git log --oneline` 에 커밋 한 줄이 보이면 된다.

### 1-8. GitHub 비공개 저장소에 올리기
사용자가 GitHub에서 비공개 저장소 **SJO1231/Helper**(빈 저장소)를 직접 만들었다. 로컬 저장소를 그 주소에 연결해 올린다.
```
git remote set-url origin https://github.com/SJO1231/Helper.git
git push -u origin main
```
- `git remote set-url origin <주소>`: 올릴 곳(origin)을 이 주소로 정한다. 처음 연결이면 `git remote add origin <주소>`.
- `git push -u origin main`: main 가지를 올리고, 앞으로 `git push`만 쳐도 여기로 가게 기억시킨다.
확인: `git remote -v` 에 Helper 주소, `git branch -vv` 에 `[origin/main]`.
기록: Claude가 실수로 `helper-v2`라는 저장소를 따로 만들어 올렸었다. 사용자 저장소로 옮긴 뒤 helper-v2는 지운다(GitHub → helper-v2 → Settings → Delete).

### 1-9. 클라우드 세션에서 이 저장소가 보이게 하기 (사용자가 할 것)
claude.ai/code → 클라우드 세션 시작 → 저장소 목록에 `SJO1231/Helper`가 보여야 한다. 안 보이면 GitHub 연결 "관리"에서 Claude GitHub App에 이 저장소 접근을 허용한다.

### 1-10. 점검 결과 (2026-10-28)
| 항목 | 상태 | 근거 |
|---|---|---|
| 로컬 → GitHub Helper push | 완료 | `git branch -vv`에 `[origin/main]`, GitHub에 커밋 3개(f6519dc, 47668d8, ca1fc82) |
| helper-v2 삭제 | 완료(사용자) | `gh repo view SJO1231/helper-v2` → 없음 |
| 프로젝트 플러그인 설정 적용 | 적용됨 | 이 폴더에서 `claude plugin list` → oh-my-claudecode·ponytail "disabled", superpowers·mattpocock "enabled" |
| 클라우드 세션 저장소 목록 | 미확인 | claude.ai/code에서 사용자가 볼 것 |
| 터미널 첫 세션 `/status` | 미확인 | 사용자가 API 키 넣고 열어 볼 것 |
| CI 파일 | 없음(의도) | S2·S5가 검증 명령을 만든 뒤 S5 끝 기준에 "ci.yml 초안" 포함 |
| 리뷰 봇 비밀값 | 없음 | 사용자가 GitHub → Settings → Secrets에 `ANTHROPIC_API_KEY` 등록 |

### 1-11. 남은 일을 하는 법 (사용자가 직접, 순서대로)

**(가) 클라우드 세션에서 Helper 저장소가 보이게 하기 — S2 전까지**
1. 브라우저에서 claude.ai/code 를 연다.
2. "클라우드 세션 시작"을 누른다. 저장소를 고르는 목록이 뜬다.
3. 목록에 `SJO1231/Helper`가 있으면 끝. 아직 아무것도 시작하지 말고 창을 닫는다.
4. 없으면 같은 창의 GitHub 줄에 있는 "관리"를 누른다. GitHub 페이지로 넘어가 Claude 앱의 저장소 접근 설정이 나온다.
5. "Only select repositories"에서 `Helper`를 추가하고 저장한다. 다시 2번을 하면 보인다.
왜: 클라우드 세션은 GitHub에서 코드를 받아 일한다. 새 저장소는 Claude 앱에 허용돼 있지 않을 수 있다.

**(나) 터미널 세션이 조직 크레딧으로 과금되는지 확인 — S1 전에 한 번**
1. platform.claude.com → API Keys → 키를 만든다(이름 helper). 키는 한 번만 보이니 복사해 둔다.
2. PowerShell을 새로 연다(기존 창 말고).
3. 아래 두 줄을 한 줄씩 넣는다.
   ```
   $env:ANTHROPIC_API_KEY = "sk-ant-복사한키"
   claude
   ```
4. 처음에 "API 키를 쓸까" 물으면 예.
5. 창 안에서 `/status`를 친다. 로그인 방식(Auth)이 API 키로 나오면 조직 크레딧이다. 구독(claude.ai)으로 나오면 환경 변수가 안 들어간 것이니 창을 닫고 2번부터 다시.
6. 확인이 끝나면 그 창에서 바로 S1을 시작해도 된다(GUIDE 4절 ②).
왜: 데스크톱 앱은 구독만 쓴다. 조직 크레딧은 이 창에서만 나간다.

**(다) 리뷰 봇용 비밀값 넣기 — S5 전에**
1. GitHub에서 `SJO1231/Helper` 저장소를 연다.
2. Settings → Secrets and variables → Actions → "New repository secret".
3. Name에 `ANTHROPIC_API_KEY`, Secret에 (나)에서 만든 키. Add secret.
왜: 리뷰 봇은 GitHub Actions가 Claude를 부르는 것이라 키가 GitHub에 있어야 한다. 이 키로 돌면 조직 크레딧에서 나간다. 워크플로 파일은 S5가 만들며, 비밀값이 먼저 있어야 첫 실행이 실패로 뜨지 않는다.

**(라) CI 파일은 지금 만들지 않는다**
돌릴 검사(`npm run verify`, `pytest core/tests`)가 아직 없다. 지금 빈 CI를 만들면 녹색만 뜨는 가짜 통과가 되고, 옛 저장소가 그 상태였다. S5 브리프 끝 기준에 "`.github/workflows/ci.yml` 초안: 위 두 명령을 그대로 실행"이 들어 있다.

**(마) `scripts/probe-public.mjs`는 S0가 만든다**
지금 열면 "없음"이 정상이다. S0 브리프에 "같은 확인을 Playwright 스크립트로도 돌 수 있게 하나 만든다"가 들어 있다.

**(바) carryover를 지울 때(1단계 끝난 뒤)**
`.claude/settings.json`의 `permissions.deny` 두 줄(`Edit(carryover/**)`, `Write(carryover/**)`)을 먼저 지우고 저장한 뒤 폴더를 지운다. 그 전에는 어떤 세션도 carryover를 고치지 못한다. 의도된 보호다.

**(사) Playwright 플러그인**
켜져 있어도 해가 없다. S0는 내장 브라우저, S4와 probe 스크립트는 npm 패키지 Playwright를 써서 플러그인과 무관하다.

**(아) 처음 세션을 열 때 플러그인 확인**
데스크톱 앱에서 이 폴더로 새 세션을 열고 스킬 목록을 본다. `oh-my-claudecode:`로 시작하는 것이 없으면 설정이 먹은 것이다. 있으면 앱의 플러그인 화면에서 oh-my-claudecode를 끈다. 터미널에서는 이미 꺼진 것을 확인했다.

## 2. 모든 세션에 똑같이 하는 것

**시작할 때** 브리프 맨 위에 이 두 줄을 항상 붙인다.
> 이 저장소의 AGENTS.md와 docs/SPEC.md만 읽고 시작한다. carryover/reference/와 옛 저장소 E:/Prodev/G2B_Helper는 열지 않는다. 아래 "끝 기준"을 통과하기 전에 끝났다고 말하지 않는다.

**세션 중에** 내가 하는 일은 결정뿐이다.
- "파일에 뭐가 있나" 같은 사실 확인은 세션이 직접 하게 한다. 내가 찾아 주지 않는다.
- "범위를 넓힐까요"는 전부 "아니오, DECISIONS.md에 '나중'으로 적어라".
- 구조(DB 테이블·컬럼 규칙·메시지 계약·폴더 경계)를 바꾸자고 하면 "안 2~3개와 되돌림 비용을 먼저 적어라" → 고른 뒤 "DECISIONS.md에 승인으로 적어라".

**끝날 때** 네 가지를 눈으로 본다. 하나라도 비면 끝난 게 아니다.
1. 끝 기준 항목마다 통과/실패/미실행과 근거(명령 출력이나 화면)가 있나.
2. 바뀐 파일이 그 세션이 맡은 폴더 안에만 있나.
3. DECISIONS.md에 이번 결정이 적혔나.
4. 마지막에 "상태 / 남은 일 / 막힌 것" 3줄이 있나. 이 3줄을 다음 세션 브리프 끝에 붙인다.

**세션 하나 = 가지 하나 = PR 하나.** 합치기 전에 리뷰 봇 1회. 지적에는 "고침" 또는 "안 고침(이유)"로만 답하게 한다.

## 3. 반장과 조 (가벼운 다중 에이전트)

- 데스크톱 앱 창 하나가 **반장**이다. 코드를 고치지 않는다. 세션을 띄우고, 결과를 검사하고, 결정을 적고, 브라우저가 필요한 일만 직접 한다.
- 클라우드 세션은 **조**다. 한 조 = 한 폴더 = 한 가지. 동시에 2~3조.
- 터미널 세션은 사람이 직접 띄운다(지갑이 환경 변수라서 반장이 대신 못 한다).
- 한 세션 안에서 하위 에이전트를 수십 개 띄우는 자동 다중 에이전트는 쓰지 않는다.

## 4. 순서와 브리프

같은 번호는 동시에 돌린다. 각 브리프 위에는 2절의 두 줄을 붙인다.

### ① S0 가능성 시험 — 데스크톱 앱, Opus, 반나절
스킬: 끝에 `superpowers:verification-before-completion`.
> 목표: https://www.g2b.go.kr 공개 화면 3종(발주계획 목록, 사전규격공개 목록, 입찰공고목록)에서 PLAN.md 2절 0단계 1~9번을 확인해 docs/feasibility.md에 적는다. 입찰공고목록에서 이미 확인한 것은 PLAN.md 0단계 표에 있으니 나머지 두 화면과 미확인 항목(입력폼 label↔ref 연결률, 테마 선택자, 직링크 호출 함수 위치, 탭을 눌러야 조회되는 화면)에 집중한다. 같은 확인을 Playwright 스크립트 scripts/probe-public.mjs로도 돌 수 있게 하나 만든다. 끝 기준: 항목마다 됨/안 됨/조건부, API 이름, 개수. 화면별 scrnNo·menuNo·그리드 수·라벨 비율 표. 하지 말 것: 제품 코드 작성, 공고번호·금액·업체명 같은 값 기록, 로그인, 서버에 1초 1회 넘는 요청.

끝나면 내가 볼 것: "안 됨"이 있으면 그 항목은 2단계로 미룬다.

### ② S1 설계 — 터미널(조직 크레딧), Opus, 반나절
스킬: 시작에 `mattpocock-skills:grilling`(질문 묶음을 받아 내가 답한다) → `superpowers:brainstorming` → `superpowers:writing-plans`.
> 목표: PLAN.md와 docs/feasibility.md로 docs/SPEC.md(현재 사양만, 200줄 이하)를 쓴다. 차례: 1 목적 한 문단, 2 용어 10개 이하(DB 테이블/표 구분), 3 폴더와 경계, 4 메시지 계약(확장↔코어 HTTP 요청·응답 모양, Grist records 규격과 같은 꼴), 5 DB 테이블·컬럼(PLAN 3절 그대로), 6 사전 4개 필드, 7 추출 규칙(모드 3개, 빈 ref 제외, 반복 접기, 프레임 합치기, 로딩 중 판별), 8 1단계 끝 기준(기능·속도 숫자), 9 하지 않는 것. DB 구조는 3안 비교를 DECISIONS.md에 적고 SPEC에는 고른 안만. 끝 기준: SPEC 200줄 이하, 모든 끝 기준이 "명령을 돌리면 참/거짓이 나오는 문장". 하지 말 것: 코드, 2단계 상세, 옛 MVP.md 인용.

내가 할 결정: DB 구조 승인, 자동 순회 포함 여부, fixture에 공개 값을 넣을지.

### ③ 동시에: S2 core / S4 그리드 비교 / S5 shared·사전 — 클라우드, Sonnet
스킬: `superpowers:test-driven-development`, 끝에 `verification-before-completion`.

S2 core
> 목표: core/ Python 패키지. gateway.py(DB의 유일한 접점: SPEC 5절 테이블 생성, 수집 저장, 조회, 사전 CRUD, 휴지통, 백업 VACUUM INTO), service.py(127.0.0.1 HTTP, 토큰 검사, SPEC 4절 계약), native_host.py(carryover/native/host.py의 native_loop 그대로, pce import 삭제, 서비스 확인·토큰 전달·예비 직접 호출). pytest: 같은 raw_hash 두 번→1건, 다른 hash→capture 2행, 빈 값은 DB 값 안 지움, 요청 ID 재시도→같은 응답, 사전 승격→컬럼 생기고 과거 행 채워짐, 10,000행 쪽 단위 조회 1초 이하. 읽을 것: SPEC.md, carryover/native/*.py(패턴만). 끝 기준: pytest 전부 통과, `grep -r sqlite3 core/`가 gateway.py 한 파일만. 하지 말 것: 화면 코드 하드코딩, 화면 키마다 컬럼, 확장·뷰어 코드.

S4 그리드 비교
> 목표: spikes/grid/에 AG Grid Community, RevoGrid, Tabulator를 같은 합성 자료(1,000×100, 10,000×100)로 올려 PLAN 1단계 "표 속도 끝 기준" 숫자를 Playwright로 잰다. 추가 비교: 기본 셀 편집기, 우클릭 메뉴, 열 타입별 표시, 라이선스, 번들 KB. 끝 기준: 표 하나와 권고 한 줄. 하지 말 것: 자체 편집기, 제품 폴더 수정.

S5 shared + 사전 모듈
> 목표: shared/에 메시지·사전·캡처 JSON 스키마(SPEC 4·6절)와 TS 타입, extension/common/dictionary.ts에 "K → 표준키(alias) → 라벨(user>screen>site>system) → 타입" 해석 함수와 "미등록 키 목록" 함수. shared/seed/에 seed 파일 형식. vitest. 루트 package.json의 `npm run verify`(tsc·vitest)와 `.github/workflows/ci.yml` 초안(`npm run verify`, `pytest core/tests`를 그대로 실행, PR 리뷰 봇 1회는 `anthropics/claude-code-action@v1` + `ANTHROPIC_API_KEY` 비밀값 + `--max-turns 5`). 끝 기준: 스키마 검증·우선순위 테스트 통과, CI가 PR에서 실제로 돈 기록. 하지 말 것: UI, DOM 접근.

### ④ 사전 seed 배치 — 터미널(조직 크레딧), Sonnet, 밤에
> 목표: `claude -p`로 돌린다. 입력: E:/Prodev/G2B_Helper/참고자료의 data_map 31개(값 출력 금지), carryover/reference/의 옛 사전, pclm의 docs/erp/fields.md(github rfastball/contract-list-manager). 출력: shared/seed/dict_key.json, dict_alias.json, dict_label.json, dict_screen.json, dict_child.json. 규칙: 같은 화면 코드는 하나로 합치고 키 합집합, 사용자 범위(접수 01001/01114·01117, 입찰 01173/01174/01179, 계약 01570/01571/01579) 밖 화면은 "참고" 표시, pclm 뜻은 근거 "pclm"으로. 끝 기준: 출력 파일에 공고번호·금액·업체명·기관명이 한 글자도 없음(검사 스크립트로 확인). 하지 말 것: 값 출력, 저장소 밖 파일 수정.

명령 예:
```
claude -p "위 브리프" --allowedTools "Read,Write,Bash" --max-turns 40 --max-budget-usd 8 --output-format json
```

### ⑤ S3 extension — 터미널(조직 크레딧) + 실제 화면 확인은 데스크톱 앱, Sonnet(막히면 Opus), 1~2일
스킬: `superpowers:executing-plans`, 막히면 `superpowers:systematic-debugging`, 끝에 `verification-before-completion`.
> 목표: extension/ MV3. sites/g2b/collect.ts(carryover/extension/collect.ts + getHeaderValue 라벨 + 빈 ref 제외 + 모드 3개 + 프레임 합치기 + 로딩 중 판별), sites/g2b/identify.ts(history.state.data·pointInfo로 화면 코드), common/(리모컨: 수집·스냅샷·기간 ±1년·조회건수. 스냅샷 창: 표를 라벨로 보여 주는 읽기 전용 표. 전송은 carryover의 host.ts·bridge.ts. 진단 줄: 제외 수·미등록 수). 빌드는 carryover/scripts/build-mvp.mjs를 옮겨 쓴다. 검증: 공개 3화면에서 스냅샷→수집→core 저장→CSV. 끝 기준: SPEC 8절 전부 + "같은 화면 10번 수집→3건" + 진단 줄. 하지 말 것: 자체 편집기, 메모·일정·테마·직링크, chrome.storage에 자료 저장.

### ⑥ S6 viewer 읽기 전용 — 클라우드, Sonnet
> 목표: viewer/ 웹 화면. core HTTP의 카탈로그를 읽어 어떤 테이블이든 같은 코드로 그린다(S4 권고 라이브러리). 읽기 전용, 쪽 단위 로딩, 정렬·필터는 core에 요청, 사용자 라벨 적용, CSV/Excel. 끝 기준: PLAN 1단계 속도 표 숫자 전부 기준 안. 하지 말 것: 편집, 자체 편집기.

### ⑦ S7 통합·설치 실측 — 데스크톱 앱, Opus
스킬: `superpowers:finishing-a-development-branch`.
> 목표: 설치 스크립트로 실제 크롬에 설치, 공개 3화면에서 1단계 끝 기준 전체 재실행, 회사 PC용 체크리스트(docs/company-check.md) 작성. 끝 기준: 설치본으로 통과한 기록. 여기까지가 1단계 종료.

### ⑧ 2단계 (폴더별 병렬, 클라우드 + 터미널)
각각 브리프는 S1이 2단계 SPEC을 쓸 때 같은 형식으로 만든다. 폴더와 순서만 적는다.
- template/core → template/cm6 → template/web → template/obsidian (클라우드, 순서대로). 웹 편집기는 PLAN 2단계의 "독립 도구 기능 목록"을 전부 갖춘 뒤에 옵시디언 껍데기로 넘어간다.
- core/excel(내보내기·읽기·차이) → viewer 차이 검토 창 → excel-addin(.xlam, 매크로 정책 확인 뒤) (터미널 + 데스크톱 실측)
- extension 2단계: 직링크·팝업 닫기·런처·메모(.md)·일정·테마 (클라우드, 공개 화면 확인은 데스크톱)
- viewer 편집: 라이브러리 기본 편집기만 (클라우드)

## 4.5 모델과 노력 수준(effort)

| 세션 | 모델 | effort | 이유 |
|---|---|---|---|
| S0 가능성 시험, S1 설계, S7 통합 | Opus | **high** | 판단이 필요한 일. xhigh는 S1의 DB 구조 비교와 실제 화면에서 원인 모를 버그를 잡을 때만 |
| S2·S4·S5·S6, 2단계 구현 | Sonnet | **medium** | 명세가 잡힌 구현. 막히면 그 세션만 Opus high로 |
| seed 배치, 리뷰 봇 | Sonnet | medium | 규칙이 분명한 반복 작업 |
| 반장(데스크톱 앱) | Opus | high | 검토·결정만 하므로 토큰이 적다 |

low는 쓰지 않는다. xhigh를 기본으로 두면 조직 크레딧이 하루에 바닥난다. 데스크톱 앱은 세션 설정에서, 터미널은 `/model`과 `/effort`(없으면 설정)에서 바꾼다.

## 5. 어느 지갑을 언제 쓰나

| 지갑 | 쓸 세션 | 비우는 법 |
|---|---|---|
| 콘솔 조직 크레딧 | S1, S3, seed 배치, PR 리뷰 봇 | 마감 전에 터미널 세션과 `claude -p` 배치로 |
| 클라우드 세션 크레딧 | S2, S4, S5, S6, 2단계의 template·viewer·extension | 폴더가 다른 세션 2~3개 동시에 |
| 구독 | S0, S7, 반장, 실제 화면 확인 | |

마감과 잔액은 `PLAN.md` 7절. 클라우드 세션은 구독 플랜(Pro 포함)이 있어야 시작된다.

## 6. 막혔을 때

- 세션이 "끝났다"고 하는데 끝 기준 근거가 없다 → "끝 기준 표를 채워라. 미실행은 미실행으로 적어라."
- 두 세션이 같은 파일을 고쳤다 → 나중 것을 되돌리고 폴더 소유를 다시 정한다. 합치지 않는다.
- 실제 화면에서만 안 된다 → `superpowers:systematic-debugging`으로 재현부터. 추측 수정 금지.
- 설계가 흔들린다 → S1로 돌아가 SPEC 한 줄을 고치고 DECISIONS에 적는다. 코드부터 고치지 않는다.
