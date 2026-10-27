# 세션 운영 설명서 (쉬운 판)

이 문서는 **무엇을, 어디서, 어떤 순서로, 무슨 글을 붙여 넣어** 일을 시키는지 적은 설명서다.
설계는 `PLAN.md`, 조심할 것은 `CAUTIONS.md`, 에이전트가 읽는 절차는 `docs/PROCESS.md`.

## 0. 낱말 풀이

| 낱말 | 뜻 |
|---|---|
| 세션 | Claude Code 창 하나. 일 하나를 시키고 끝나면 닫는다 |
| 브리프 | 세션을 열고 **처음 붙여 넣는 지시문**. 업무 지시서. 목표·읽을 것·끝 기준·하지 말 것 네 칸 |
| 끝 기준 | "이것이 되면 끝"이라고 미리 정한 조건. 맞다/틀리다가 나오는 문장이어야 한다 |
| 가지 | git의 branch. 일 하나마다 가지 하나를 만들어 거기서 작업한다 |
| PR | 가지의 작업을 main에 합쳐 달라는 요청(Pull Request). GitHub에서 본다 |
| 1단계 | 꼭 있어야 하는 뼈대: 화면 읽기(스냅샷) → 이름 바로잡기(사전) → 저장(DB) → 보기(읽기 전용 표) → 엑셀 내보내기 |
| 2단계 | 뼈대 위에 붙이는 것: 직링크, 팝업 닫기, 메모, 일정, 테마, 표 편집, 템플릿 편집기, 엑셀 연동 |
| SPEC.md | 설계서. "지금 만들 것이 무엇인지"만 적는 파일. S1이 채운다 |
| DECISIONS.md | 결정 일기. "언제 무엇을 왜 정했나" 한 줄씩. "나중: ○○"도 여기 적는다 |
| 반장 | 데스크톱 앱 창 하나. 코드를 안 고치고 세션을 띄우고 검사하고 결정만 한다 |
| 조 | 반장이 띄운 작업 세션. 한 조는 폴더 하나만 만진다 |
| 스킬 | 세션에 붙이는 작업 방식 안내. `/superpowers:…`처럼 부른다 |
| 지갑 | 돈이 나가는 곳 셋: 구독, 콘솔 조직 크레딧, 클라우드 세션 크레딧 |

## 1. 세 일터와 세 지갑

| 일터 | 여는 법 | 지갑 | 쓰는 일 |
|---|---|---|---|
| 데스크톱 앱 | Claude 데스크톱 → Code → 폴더 `E:/Prodev/Helper` | 구독 | 반장, 나라장터 화면 보기(내장 브라우저), 설치 확인 |
| 터미널 | PowerShell에서 API 키 넣고 `claude` | 콘솔 조직 크레딧 | 설계(S1), 확장(S3), 밤 배치, 리뷰 봇 |
| 클라우드 | claude.ai/code → 클라우드 세션 시작 → 저장소 `SJO1231/Helper` | 클라우드 세션 크레딧(다 쓰면 구독) | 화면 없이 되는 코드. 2~3개 동시 |

터미널 여는 법:
```
$env:ANTHROPIC_API_KEY = "sk-ant-여기에키"
claude
```
창이 뜨면 `/status`를 친다. 로그인 방식이 API 키로 보이면 조직 크레딧이다. 이 창을 닫아도 다른 창은 영향 없다.
클라우드 세션은 구독(Max나 Pro)이 있어야 열린다. 잔액은 claude.ai → Settings → Usage.

## 2. 준비는 끝났다

2026-10-28에 끝난 것: 옛 북마클릿을 `carryover/reference/`로 옮김, `AGENTS.md`(규칙)·`CLAUDE.md`(한 줄 `@AGENTS.md`), `docs/SPEC.md`(빈 파일)·`docs/DECISIONS.md`·`docs/PROCESS.md`, `.gitignore`, `README.md`, `.claude/settings.json`(superpowers·mattpocock 켬, OMC·ponytail 끔, carryover 편집 금지), git 첫 커밋, GitHub 비공개 저장소 `SJO1231/Helper`에 올림, S0 세션 실행과 PR #1.

아직 사용자가 할 것 세 가지:
- **(가) 클라우드에서 저장소 보이는지.** claude.ai/code → 클라우드 세션 시작 → 목록에 `SJO1231/Helper`가 있으면 끝. 없으면 GitHub "관리"에서 Claude 앱에 Helper를 허용.
- **(나) 터미널 과금 확인.** 위 터미널 여는 법대로 열고 `/status`. S1 전에 한 번.
- **(다) 리뷰 봇 비밀값.** GitHub Helper 저장소 → Settings → Secrets and variables → Actions → New secret → 이름 `ANTHROPIC_API_KEY`, 값은 콘솔 키. S5 전에.

하지 않는 것: 빈 CI 파일(검사가 생기는 S5에서 만든다), 회사 화면 정보를 밖으로 가져오는 일(어떤 형태로도 없다. 회사에서는 설치해서 쓰기만 하고, 확장이 화면을 스스로 사전에 등록한다).

## 3. 매 세션 똑같이 하는 것

**시작.** 브리프 맨 위에 이 두 줄을 붙인다.
> 이 저장소의 AGENTS.md와 docs/SPEC.md만 읽고 시작한다. carryover/reference/와 옛 저장소 E:/Prodev/G2B_Helper는 열지 않는다. 아래 "끝 기준"을 통과하기 전에 끝났다고 말하지 않는다.

**중간.** 나는 결정만 한다.
- 파일에 뭐가 있나 같은 사실 확인은 세션이 직접 한다.
- "범위를 넓힐까요"에는 "아니오. DECISIONS.md에 '나중: ○○'으로 적어라".
- 구조(DB 테이블·컬럼 규칙·메시지 계약·폴더 경계)를 바꾸자고 하면 "안 2~3개와 되돌림 비용을 먼저 적어라" → 고른 뒤 "DECISIONS.md에 '승인'으로 적어라".

**끝.** 네 가지를 눈으로 본다. 하나라도 비면 끝난 게 아니다.
1. 끝 기준마다 통과/실패/미실행과 근거(명령 출력이나 화면)가 있나.
2. 바뀐 파일이 맡은 폴더 안에만 있나.
3. DECISIONS.md에 이번 결정이 적혔나.
4. 마지막에 "상태 / 남은 일 / 막힌 것" 3줄이 있나. 이 3줄을 다음 브리프 끝에 붙인다.

**세션 하나 = 가지 하나 = PR 하나.** 합치기 전 리뷰 봇 1회(S5 뒤부터), 반장 눈 1회. 지적에는 "고침" 또는 "안 고침(이유)"로만 답하게 한다.

## 4. 반장과 조

- 데스크톱 앱 창 하나가 반장. 코드를 고치지 않는다. 세션을 띄우고, 결과를 검사하고, 결정을 적고, 브라우저가 필요한 일만 직접 한다.
- 클라우드 세션이 조. 한 조 = 폴더 하나 = 가지 하나. 동시에 2~3조.
- 터미널 세션은 사람이 직접 띄운다(지갑이 환경 변수라서).
- 한 세션 안에서 하위 에이전트를 수십 개 띄우는 자동 다중 에이전트는 쓰지 않는다.

## 5. 순서와 브리프

같은 번호는 동시에 돌린다. 브리프 위에는 3절의 두 줄을 붙인다.

### ① S0 가능성 시험 — 끝남 (PR #1)
목록 화면 3종 확인 완료. 결과는 `docs/feasibility.md`, 재현 스크립트는 `scripts/probe-public.mjs`. 안 됨 0, 조건부 4(사전규격 구분, 자동 순회, 탭 전환, 두 줄 셀 행 높이), 모름 1(로그인 화면). PR #1을 보고 합친다.

### ①-2 S0-b 상세 화면 확인 — 데스크톱 앱, Opus high, 반나절
스킬: 끝에 `/superpowers:verification-before-completion`.
> 목표: docs/feasibility.md와 scripts/probe-public.mjs를 바탕으로 공개 화면의 **상세 화면**을 확인해 feasibility.md에 "상세 화면" 절을 더한다. 1) 발주계획 목록 첫 행 사업명 클릭: 같은 창/팝업/새 탭 중 무엇인지, 전환 뒤 scrnNo·menuNo·menuCangVal, 그리드 수(보임/전체), 폼 값 컴포넌트 수와 라벨 비율, 돌아오는 법. 2) 사전규격공개: 라디오 → 검색 → 첫 행 클릭, 같은 항목. 3) 입찰공고목록: 첫 행 공고명 클릭, 같은 항목 + 상세 안 하위 표(물품·수요기관·자격제한 등) 개수와 각 그리드의 화면 ID·헤더 라벨 비율. 4) 개찰결과 화면: 메뉴로 열어 목록 코드, 진행상황(유찰·개찰완료) 링크를 눌렀을 때 열리는 것과 그 코드·그리드 수. 5) 그리드 없는 상세 폼 화면이 있으면 ref 있는 컴포넌트 수와 라벨 비율. 6) 전환 때 history.state.data가 바뀌는지, 돌아올 때 되돌아오는지. probe-public.mjs에 같은 확인을 더해 2회 이상 같은 결과. "안 됨"이 있으면 DECISIONS.md에 "나중: ○○, 이유: S0-b에서 안 됨"으로 적어라. 끝 기준: 화면마다 위 항목 표, 숫자가 스크립트 출력과 일치, 값(사업명·공고번호·금액·업체명·기관명) 0건. 하지 말 것: 제품 코드, 로그인, 값 기록, 동작 사이 1.5초 미만, 등록·제출·삭제·다운로드 버튼 클릭. 가지 s0/detail-screens, PR 하나.

### ② S1 설계 — 터미널(조직 크레딧), Opus high, 반나절
스킬: 시작에 `/mattpocock-skills:grilling`(질문 묶음을 받아 내가 답한다) → `/superpowers:brainstorming` → `/superpowers:writing-plans`.
> 목표: PLAN.md와 docs/feasibility.md로 docs/SPEC.md(현재 사양만, 200줄 이하)를 쓴다. 차례: 1 목적 한 문단, 2 용어 10개 이하(DB 테이블/표 구분), 3 폴더와 경계와 코드 규칙, 4 메시지 계약(확장↔코어 HTTP 요청·응답 모양, Grist records 규격과 같은 꼴), 5 DB 테이블·컬럼(PLAN 3절 그대로), 6 사전 4개 필드(화면 사전 키에 검색유형 값을 넣을지 결정 포함), 7 추출 규칙(모드 3개, 빈 ref 제외, 같은 dataList 그리드 하나만, 프레임 합치기, 로딩 중 판별, 라벨은 label[for]+th+title), 8 1단계 끝 기준(기능·속도 숫자), 9 하지 않는 것. DB 구조는 3안 비교를 DECISIONS.md에 적고 SPEC에는 고른 안만. 끝 기준: SPEC 200줄 이하, 모든 끝 기준이 "명령을 돌리면 참/거짓이 나오는 문장". 하지 말 것: 코드, 2단계 상세, 옛 MVP.md 인용.
>
> DECISIONS.md의 "나중:" 항목은 SPEC.md 9절 "하지 않는 것"에 옮겨 적어라.
> 1단계 끝 기준에 넣어라: 처음 보는 화면을 열면 화면 사전에 자동 등록되고, 같은 화면을 다시 열어도 한 번만 등록된다(회사 화면 정보는 제품 안 DB에만 남고 밖으로 나가지 않는다).
> 코드 규칙 네 줄을 AGENTS.md "만드는 규칙"에 추가하라: 파일 하나는 한 가지 일, 300줄 넘으면 나눈다 / 한 줄 120자 안, 압축해서 몰아 쓰지 않는다 / 함수 이름으로 뜻을 알게 짓고 주석은 "왜"만 / 기능 하나 고칠 때 그 폴더 밖 파일을 건드리게 되면 먼저 묻는다.

내가 할 결정: DB 구조 승인, 자동 순회 포함 여부, fixture에 공개 값을 넣을지, 화면 사전 키에 검색유형을 넣을지.

### ③ 동시에: S2 core / S4 그리드 비교 / S5 shared·사전 — 클라우드, Sonnet medium
스킬: `/superpowers:test-driven-development`, 끝에 `/superpowers:verification-before-completion`.

S2 core
> 목표: core/ Python 패키지. gateway.py(DB의 유일한 접점: SPEC 5절 테이블 생성, 수집 저장, 조회, 사전 CRUD, 화면 자동 등록(중복 제어), 휴지통, 백업 VACUUM INTO), service.py(127.0.0.1 HTTP, 토큰 검사, SPEC 4절 계약), native_host.py(carryover/native/host.py의 native_loop 그대로, pce import 삭제, 서비스 확인·토큰 전달·예비 직접 호출). pytest: 같은 raw_hash 두 번→1건, 다른 hash→capture 2행, 빈 값은 DB 값 안 지움, 요청 ID 재시도→같은 응답, 사전 승격→컬럼 생기고 과거 행 채워짐, 같은 화면 등록 두 번→1건, 10,000행 쪽 단위 조회 1초 이하. 읽을 것: SPEC.md, carryover/native/*.py(패턴만). 끝 기준: pytest 전부 통과, `grep -r sqlite3 core/`가 gateway.py 한 파일만. 하지 말 것: 화면 코드 하드코딩, 화면 키마다 컬럼, 확장·뷰어 코드.

S4 그리드 비교
> 목표: spikes/grid/에 AG Grid Community, RevoGrid, Tabulator를 같은 합성 자료(1,000×100, 10,000×100)로 올려 PLAN 1단계 "표 속도 끝 기준" 숫자를 Playwright로 잰다. 추가 비교: 기본 셀 편집기, 우클릭 메뉴, 열 타입별 표시, 라이선스, 번들 KB. 끝 기준: 표 하나와 권고 한 줄. 하지 말 것: 자체 편집기, 제품 폴더 수정.

S5 shared + 사전 모듈 + 검증 명령 + CI
> 목표: shared/에 메시지·사전·캡처 JSON 스키마(SPEC 4·6절)와 TS 타입, extension/common/dictionary.ts에 "K → 표준키(alias) → 라벨(user>screen>site>system) → 타입" 해석 함수와 "미등록 키 목록"·"미등록 화면" 함수. shared/seed/에 seed 파일 형식. vitest. 루트 package.json의 `npm run verify`(tsc·vitest)와 `.github/workflows/ci.yml` 초안(`npm run verify`, `pytest core/tests`를 그대로 실행, PR 리뷰 봇 1회는 `anthropics/claude-code-action@v1` + `ANTHROPIC_API_KEY` 비밀값 + `--max-turns 5`). 끝 기준: 스키마 검증·우선순위 테스트 통과, CI가 PR에서 실제로 돈 기록. 하지 말 것: UI, DOM 접근.

### ④ 사전 seed 배치 — 터미널(조직 크레딧), Sonnet, 밤에
> 목표: `claude -p`로 돌린다. 입력: E:/Prodev/G2B_Helper/참고자료의 data_map 31개(값 출력 금지), carryover/reference/의 옛 사전, pclm의 docs/erp/fields.md(github rfastball/contract-list-manager). 출력: shared/seed/dict_key.json, dict_alias.json, dict_label.json, dict_screen.json, dict_child.json. 규칙: 같은 화면 코드는 하나로 합치고 키 합집합, 사용자 범위(접수 01001/01114·01117, 입찰 01173/01174/01179, 계약 01570/01571/01579) 밖 화면은 "참고" 표시, pclm 뜻은 근거 "pclm"으로. 끝 기준: 출력 파일에 공고번호·금액·업체명·기관명이 한 글자도 없음(검사 스크립트로 확인). 하지 말 것: 값 출력, 저장소 밖 파일 수정.

명령 예:
```
claude -p "위 브리프" --allowedTools "Read,Write,Bash" --max-turns 40 --max-budget-usd 8 --output-format json
```

### ⑤ S3 extension — 터미널(조직 크레딧) + 실제 화면 확인은 데스크톱 앱, Sonnet(막히면 Opus), 1~2일
스킬: `/superpowers:executing-plans`, 막히면 `/superpowers:systematic-debugging`, 끝에 `/superpowers:verification-before-completion`.
> 목표: extension/ MV3. sites/g2b/collect.ts(carryover/extension/collect.ts + 헤더 라벨(getHeaderID→getHeaderValue) + 빈 ref 제외 + 같은 dataList 그리드 하나만 + 모드 3개 + 프레임 합치기 + 로딩 중 판별), sites/g2b/identify.ts(history.state.data의 menuNo·scrnNo·menuCangVal과 검색유형으로 화면 코드), common/(리모컨: 수집·스냅샷·기간 ±1년·조회건수. 스냅샷 창: 표를 라벨로 보여 주는 읽기 전용 표. 처음 보는 화면은 화면 사전에 자동 등록. 전송은 carryover의 host.ts·bridge.ts. 진단 줄: 제외 수·미등록 키 수·새로 등록한 화면). 빌드는 carryover/scripts/build-mvp.mjs를 옮겨 쓴다. 검증: 공개 3화면에서 스냅샷→수집→core 저장→CSV. 끝 기준: SPEC 8절 전부 + "같은 화면 10번 수집→3건" + "같은 화면 다시 열어도 등록 1건" + 진단 줄. 하지 말 것: 자체 편집기, 메모·일정·테마·직링크, chrome.storage에 자료 저장.

### ⑥ S6 viewer 읽기 전용 — 클라우드, Sonnet
> 목표: viewer/ 웹 화면. core HTTP의 카탈로그를 읽어 어떤 테이블이든 같은 코드로 그린다(S4 권고 라이브러리). 읽기 전용, 쪽 단위 로딩, 정렬·필터는 core에 요청, 사용자 라벨 적용, CSV/Excel. 끝 기준: PLAN 1단계 속도 표 숫자 전부 기준 안. 하지 말 것: 편집, 자체 편집기.

### ⑦ S7 통합·설치 확인 — 데스크톱 앱, Opus high
스킬: `/superpowers:finishing-a-development-branch`.
> 목표: 설치 스크립트로 실제 크롬에 설치, 공개 3화면에서 1단계 끝 기준 전체 재실행, 회사용 설치 안내(docs/company-check.md: 설치 → 화면 열기 → 버튼, 사람이 보는 확인 항목만. 파일을 밖으로 내보내는 단계 없음) 작성. 끝 기준: 설치본으로 통과한 기록. 여기까지가 1단계 종료.

### ⑧ S1-2 2단계 설계 — 새 세션, 터미널 또는 데스크톱, Opus high
> 목표: 1단계 SPEC.md와 DECISIONS.md의 "나중:" 목록을 읽고 SPEC.md에 2단계 절을 더한다(PLAN 2단계 항목: extension 편의 기능, viewer 편집, template 독립 도구 + 옵시디언 껍데기, core/excel + excel-addin). 기능마다 브리프(목표·읽을 것·끝 기준·하지 말 것)를 GUIDE.md 5절 ⑨ 밑에 써라. 끝 기준: 2단계 절 150줄 이하, 브리프마다 끝 기준이 참/거짓 문장. 하지 말 것: 코드.

### ⑨ 2단계 작업 세션 (S1-2가 쓴 브리프대로, 폴더별 병렬)
- template/core → template/cm6 → template/web → template/obsidian (클라우드, 순서대로). 웹 편집기는 PLAN 2단계의 "독립 도구 기능 목록"을 전부 갖춘 뒤에 옵시디언 껍데기로 넘어간다.
- core/excel(내보내기·읽기·차이) → viewer 차이 검토 창 → excel-addin(.xlam, 매크로 정책 확인 뒤) (터미널 + 데스크톱 확인)
- extension 2단계: 직링크(`com.gfnOpenMenuMove`)·팝업 닫기·런처·메모(.md)·일정·테마 (클라우드, 공개 화면 확인은 데스크톱)
- viewer 편집: 라이브러리 기본 편집기만 (클라우드)

## 6. 모델과 노력 수준(effort)

| 세션 | 모델 | effort | 이유 |
|---|---|---|---|
| S0-b, S1, S1-2, S7, 반장 | Opus | high | 판단이 필요한 일. xhigh는 S1의 DB 구조 비교와 원인 모를 버그만 |
| S2·S4·S5·S6, 2단계 구현 | Sonnet | medium | 명세가 잡힌 구현. 막히면 그 세션만 Opus high |
| seed 배치, 리뷰 봇 | Sonnet | medium | 규칙이 분명한 반복 작업 |

low는 쓰지 않는다. xhigh를 기본으로 두면 조직 크레딧이 하루에 바닥난다.

## 7. 어느 지갑을 언제 쓰나

| 지갑 | 쓸 세션 |
|---|---|
| 콘솔 조직 크레딧 | S1, S3, seed 배치, PR 리뷰 봇 |
| 클라우드 세션 크레딧 | S2, S4, S5, S6, 2단계의 template·viewer·extension |
| 구독 | S0-b, S7, 반장, 실제 화면 확인 |

마감과 잔액, 날짜별 배정은 `PLAN.md` 7절.

## 8. 막혔을 때

- 세션이 "끝났다"는데 끝 기준 근거가 없다 → "끝 기준 표를 채워라. 미실행은 미실행으로 적어라."
- 두 세션이 같은 파일을 고쳤다 → 나중 것을 되돌리고 폴더 소유를 다시 정한다.
- 실제 화면에서만 안 된다 → `/superpowers:systematic-debugging`으로 재현부터. 추측 수정 금지.
- 설계가 흔들린다 → S1로 돌아가 SPEC 한 줄을 고치고 DECISIONS에 적는다. 코드부터 고치지 않는다.
- 세션이 "회사에서 파일을 가져오라"고 하면 → 안 된다. 회사 정보는 제품 안에만 남는다.
