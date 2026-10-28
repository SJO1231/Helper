# v4.2 북마클릿 기능 명세 복원 (2단계 설계용)

읽은 것: carryover/reference/g2b-toolbox-v4.2.js 4,279줄 전체(읽기만). 괄호의 `L숫자`는 그 파일의 줄이다.
한 줄 비교는 docs/v42-gap.md에 있으니 여기서는 되풀이하지 않고 그 아래 상세만 적는다.
용어: 저장소 = v4.2의 IndexedDB object store, DB 테이블 = SQLite, 표 = 나라장터 화면 그리드. 실제 값은 적지 않았다.
"지금"은 docs/SPEC.md 4절(HTTP)·5절(DB 테이블) 기준이고 `S숫자`는 그 파일의 줄이다. 쓰기는 `g2b_capture` POST와 `dict_*`뿐이고 나머지는 405(S63).
메모·일정 테이블은 1단계 제외 목록(S203~204)이라, 옮기려면 DB 테이블 추가 = 구조 변경 승인(AGENTS)이 먼저다.

## 0. 공통 부품 (기능마다 되풀이되므로 한 번만 적는다)

### 0.1 저장소 (IndexedDB `G2BToolboxDB_v42`, 버전 8: L19-20, L119-156)
| 저장소 | 키(keyPath) | 인덱스 | 쓰는 기능 |
|---|---|---|---|
| notes | id | kind, createdAt, dueAt, deletedAt | 메모/일정 |
| toolMemos | id | scope, screenKey | v3 메모. 시작 때 notes로 한 번 옮기고 읽기만 |
| launcherScripts | id | sortOrder | 런처 |
| tableRegistry / tableRows | id | kind / tableId, updatedAt | DB 브라우저 |
| tableColumns | id | tableId | 열 표시·폭·순서 |
| collectionSources / staging | id | targetTable (+screenKey / createdAt) | 수집규칙 / 추출 저장 기록 |
| dictKeys, dictCodes, dictExcluded, dictHeaders | id | (dictCodes: key, dictHeaders: tableId) | 사전 |
| screenRegistry | key | depth2, url | 화면 정보 |
| relationships | id | fromTable, toTable | 관계(저장만, 6절 참고) |
| rawCaptures / rawSessions | id(자동증가) / sessionId | sessionId, capturedAt, screenKey, screenHash | RAW |
| collectorEvents | id | kind, capturedAt, screenKey | 이벤트 로그·직링크 |
| settings | id | - | 위치·탭·접힘 등(0.3) |

### 0.2 localStorage (L23-25)
| 키 | 값 | 규칙 |
|---|---|---|
| g2b_tb_v42_position | JSON `{left,top}` | 읽기·쓰기 모두 try/catch로 삼킨다(L59-72) |
| g2b_tb_v42_last_invoke | 밀리초 문자열 | 1,600ms 안에 다시 호출하면 위치 초기화(L22, L2076) |
| g2b_tb_v42_tab | work·notes·launcher·db·collect | 시작 때 settings의 mainPosition·mainTab이 이 둘을 덮어쓴다(L4261-4266) |

### 0.3 settings 저장소 `{id, value, updatedAt}` (L1652-1659)
| id | value | 쓰는 곳 | 다시 읽는가 |
|---|---|---|---|
| mainPosition / mainTab | `{left,top}` / 글자 | 패널 끌기·탭 전환(L2157, L2187) | 읽음(L4261) |
| window:<persistKey> | `{left,top}` (+`width,height`) | 떠다니는 창(L1785) | **안 읽음**: 위치 저장이 복원되지 않는다 |
| sticky:<메모id> | `{left,top,width,height,min}` | 스티커(L2578) | 읽음(L2569) |
| scheduleGroupHidden | `{그룹이름: bool}` | 일정 목록 접힘(L2509) | 읽음(L2500) |
| noteManagerColumns | 열 이름 배열 | 메모/일정 상세 열 설정(L3060) | 읽음(L2938) |
| dbQuickTabs | 테이블 id 배열 | DB 브라우저 빠른 탭(L3307) | 읽음(L3294) |
| migratedV4 | true | v3 메모 이전 표시(L1676) | 읽음(L1661) |

### 0.4 화면 식별과 화면 조건 (L403-460, L865-891, L2600-2623)
| 항목 | 내용 |
|---|---|
| 화면 키 | 나라장터 호스트면 `G2B-`+해시(주소(origin+path, 쿼리·해시 뺌)+`areaCd`+`depth1`+`depth2`), 아니면 `URL-`+해시. 해시는 FNV-1a 32비트 16진 |
| 코드 값 출처 | areaCd·depth1~3은 모든 프레임의 폼 값에서 처음 찾은 것(L392). 화면 이름은 첫 보이는 제목 태그, 없으면 문서 제목 |
| 조건 객체 | `{url, urlMode(path\|exact), useAreaCd, areaCd, useDepth1, depth1, useDepth2, depth2, useDepth3, depth3}` |
| 기본값 | url=현재 주소, urlMode=path, use* 는 나라장터이고 값이 있을 때만 true(depth3은 늘 false)(L869-872) |
| 일치 규칙 | url이 있으면 path는 정규화 주소 같음, exact는 전체 href 같음. 그 뒤 use*가 켜진 항목만 값 같음 확인(L873-891) |
| 편집 창 | URL 칸, 모드 선택, 항목 4개(체크+값). 값은 저장된 값 → 현재 화면 값 순으로 채움 |
| 화면 등록 | 화면이 바뀌면 screenRegistry에 upsert: 키·주소·이름·깊이·코드값·시그니처 수·firstSeenAt·lastSeenAt(L865-868) |
| 바뀜 감지 | 모든 문서에 MutationObserver, 500ms 지연(L4177-4190). 1,400ms마다 새 프레임에 다시 붙임(L4272). 키가 바뀌고 현재 탭이 메모/런처면 다시 |
|  | 그림(L4172) |
| 지금으로 옮길 때 | 화면 = (site, menu_no)(S14). 주소가 늘 `/`라 url 조건은 무의미하다. 조건은 `dict_screen` 한 행을 가리키면 충분할 수 있다 |

### 0.5 떠다니는 창 openWindow (L1755-1813)
| 항목 | 내용 |
|---|---|
| 같은 창 하나 | instanceKey(없으면 persistKey, 없으면 제목)가 같은 창이 열려 있으면 닫고 새로 연다(L1757) |
| 크기·위치 | 기본 900×620, 화면보다 24px 작게 제한, 최소 420×260. 처음 위치는 리모컨 왼쪽 옆, 창마다 10px씩 어긋남(L1746) |
| 조작 | 머리 끌기(버튼·입력 위는 제외), × 닫기. 크기 조절은 `resizable` 켠 창만(그런 호출은 없음) |
| z-index | 패널·토스트 2147483646~7, 창 …645, 스티커 …644 |

### 0.6 SmartGrid: v4.2의 자체 표 (L1814-2075). AGENTS가 금지한 종류라 동작만 기록한다
| 항목 | 내용 |
|---|---|
| 열 | 주어지지 않으면 행 키의 합집합 중 visibleFor 통과분. 순서는 tableColumns.order(없으면 9999) → 이름순. 머리=라벨, 툴팁=원본 키, 최소 폭 max(70, 저장 폭 |
|  | 기본 130) |
| 검색·필터 | 검색 칸(모든 열의 값·라벨 부분 일치), 열 선택+필터값(부분 일치). 건수 "N행". 첫 열 체크박스, 머리 체크는 보이는 행 전체 |
| 행 제한 | 기본 1,000행까지만 그린다(L1934). 넘어도 안내가 없다. 정렬·열 폭·열 순서 조작 없음 |
| 편집 | 더블클릭·Enter·F2·글자 입력(그 글자로 시작). Enter 저장, Esc 취소, 포커스를 잃으면 저장. 저장 중 입력 잠김, 실패하면 빨간 테두리+토스트+편집 유지. 행마다 순서 |
|  | 큐(L1860-1923) |
| 복사 | Ctrl+C = 체크한 행들, 없으면 선택 셀의 **행 전체**를 탭·줄바꿈 글자로(L2013). 셀 범위 복사는 없다 |
| 붙여넣기 | Ctrl+V = 클립보드 글자를 선택 셀부터 행·열로 풀어 셀마다 저장. 중간 실패하면 멈추고 그 칸을 편집 상태로(L2024-2054) |
| 값 | 편집값은 늘 글자(숫자로 안 바꿈). 객체 값은 JSON 글자로 표시(L713-723) |

### 0.7 사전 캐시와 표시 규칙 (L662-737)
| 함수 | 규칙 |
|---|---|
| labelFor(키, 테이블) | dictHeaders[`테이블::키`] → dictHeaders[`*::키`] → 키에서 마지막 `.` 뒤 이름의 dictKeys.label → 그 이름. 키가 |
|  | `receipt.`·`bid.`·`contract.`로 시작하면 "접수·"·"입찰·"·"계약·"을 앞에 붙임 |
| valueFor | 마지막 `.` 뒤 키의 dictCodes에 값이 있으면 뜻, 없으면 원값 |
| visibleFor | dictExcluded에 있으면 숨김, tableColumns의 visible=false여도 숨김. colOrder 기본 9999, colWidth 기본 130 |
| 새로고침 | 시작, 사전 창을 그릴 때, 추출·키/열 추가 뒤에만 다시 읽는다 |
| 지금과 차이 | 라벨 우선순위는 user>screen>site>system(S118)이고 접두어 규칙은 없다. 숨김은 `dict_key.display`가 후보(v42-gap 결정 10) |

### 0.8 알림
토스트 2.2초(L683-698)가 기본, 위험·입력 부족은 `alert` 15곳, 삭제·덮어쓰기 확인은 `confirm` 4곳, 일정 일괄 입력은 `prompt` 2곳이다.

## 1. 메모/일정 (카드·스티커·화면 조건·달력·검색·멘션/태그)
| 항목 | 내용 |
|---|---|
| 저장 구조 | `notes`: id(`note_<uuid>`), kind(general·screen·schedule), title, content, createdAt, updatedAt(ISO), |
|  | color(키), important(0/1), pinned(0/1), group, dueAt(ISO 또는 ""), deletedAt(ISO\|null), screenRule(조건 객체\|null), |
|  | extra(객체), mentions[], tags[], bangs[] (L1636-1641, L1623-1635) |
| 색 | yellow(기본)·green·pink·blue·lavender·gray 6가지, 값은 연한 hex(L1599). 저장은 색 이름만 |
| 멘션·태그 | 저장할 때마다 본문에서 뽑는다: `@이름`·`#태그`·`!표시`. 앞이 줄 처음/공백이고 뒤는 공백·@·#·!가 아닌 글자, 중복 제거(L1607). 칩·클릭 이동은 없고 **검색 대상일 |
|  | 뿐**이다 |
| 제목 | 제목이 비면 본문 첫 비지 않은 줄 60자, 그것도 없으면 "(제목 없음)". 머리글 [일반]·[화면]·[일정](L1609-1619) |
| 화면 요소(패널) | 모드 단추 전체·일반메모·화면메모·일정·상세 / 검색 칸+검색 단추+정렬 선택 / `+ 메모` `+ 일정` / 카드 목록(L2291-2330) |
| 카드 요소 | 제목 칸(처음엔 숨김, `+ 제목`으로 열고 포커스를 잃으면 저장, 비면 다시 숨김), ★중요, 📌고정, ▣스티커, ⚙화면조건(화면 메모만), ●색(고르기 창), 🗑휴지통(확인창), 본문 |
|  | 칸, 아래 "기준 … · 생성 …"(L2354-2446) |
| 정렬 | 고정 먼저 → 생성 최신(기본)·생성 오래된순·기준일순(기준일 없음은 맨 뒤)·제목순(ko). 정렬 선택은 저장 안 함(L2332) |
| 동작 흐름 | `+ 메모` = 빈 메모를 **즉시 저장**하고 카드를 그림(L1636, L2316). 본문은 입력 250ms 뒤 자동 저장(L2429). 별·고정·색은 즉시 저장 뒤 다시 그림. 휴지통 |
|  | = deletedAt만 채움. 복원·비우기 UI 없음 |
| 일정 입력 | `+ 일정`은 대화 창(480×480, 화면 메모는 610): 제목·내용·그룹·기준일시(datetime-local)·색. **저장을 눌러야** 만들어진다. 일정 카드 더블클릭 = 같은 |
|  | 창으로 수정(L2636-2684) |
| 시간 | dueAt은 `new Date(로컬).toISOString()`이라 UTC로 저장되고 표시는 로컬이다. 날짜 묶음·달력은 로컬 날짜로 센다(L2677, L2476) |
| 화면 메모 | kind=screen은 현재 화면이 screenRule과 일치할 때만 목록에 나온다. "전체" 모드에도 같다(L2347). 새 화면 메모의 조건은 현재 화면 기본값(0.4) |
| 일정 목록 | 일정 모드는 미지정·오늘·이번주(월~일)·이번달·그 외로 묶고 머리 클릭으로 접힘(settings 저장)(L2489-2517). 같은 주의 지난 날도 "이번주" |
| 스티커 | 화면 위 고정 상자 300×190(리모컨 옆, 18px 어긋남), 제목+본문 글자(**읽기 전용, 열 때 내용 복사**), ▣ 최소화(170×36), × 닫기. 끌기·크기 조절 때 위치 저장. |
|  | 메모마다 하나. 새로 고침 뒤 자동으로 다시 열지 않는다(L2545-2599) |
| 달력 창 | "일정보기" 1040×690: 월·주·일 전환, ≪‹오늘‹날짜›≫, 다중선택. 이동 폭은 ≪≫가 월=±1년·주=±1달·일=±7일, ‹›가 월=±1달·주=±7일·일=±1일(L2761-2776) |
| 달력 표시 | 월 = 6주×7칸(월요일 시작), 하루 4건까지, 일정 클릭=수정 창. 주 = 7칸 "HH:MM 제목". 일 = 시간순 목록. 날짜 숫자 클릭=일 보기, 다중선택 중엔 날짜 |
|  | 토글(L2820-2895) |
| 달력 일괄 입력 | 다중선택한 날짜 N일 → `prompt` 제목·내용 → 각 날 09:00 일정 생성(L2896-2910) |
| 일정 검색 | 달력 아래 검색 칸: 제목·내용·태그·그룹 부분 일치, 100건까지, 클릭=그날 일 보기(L2911-2931) |
| 상세 창 | "메모/일정 상세" 1050×650: 전체·일반·화면·일정·달력 탭, 검색(메모 전체 JSON 부분 일치), 그룹 필터, 열 설정(열 이름 직접 입력·추가·삭제, 기본 8열), 위 표(읽기 |
|  | 전용)+아래 상세 보기+편집 단추(L2937-3067) |
| 숨은 규칙 | 달력 상태(보기·기준일)는 창을 열 때마다 초기화. 메모 검색은 JSON 문자열 포함이라 키 이름(`color` 등)도 걸린다. 휴지통 메모는 DB 브라우저의 `sys.notes`에서만 보인다 |
| 옮길 때 걸리는 점 | 쓰기 길은 `memo`·`schedule` DB 테이블이 없어 먼저 구조 승인이 필요(S204). 메모를 사람이 자주 고치는 자료라 `request_log` 멱등 |
|  | 키·store_version 규칙(S101~108)과 250ms 자동 저장이 맞물려 요청이 많아진다 |

## 2. 런처·직링크
| 항목 | 내용 |
|---|---|
| 런처 저장 | `launcherScripts`: id(`script_<uuid>`), name, description, code, sortOrder(0이면 100으로 바뀜), |
|  | screenRule\|null, createdAt, updatedAt(L3123, L3146-3155) |
| 런처 화면 | 런처 탭: 2열 단추(이름+작은 설명), 우상단 ⋮ 수정, `+ 런처 추가`. 수정 창 560×590: 이름·설명·정렬 숫자·범위(모든 화면/화면 조건)·코드 칸(250px)·조건 |
|  | 편집·저장·삭제(확인창)(L3068-3165) |
| 목록 규칙 | sortOrder 오름차순. screenRule이 없으면 어디서나, 있으면 현재 화면과 일치할 때만 보임. 화면이 바뀌면 다시 그림(L3077-3092, L4174) |
| 실행 | `new Function("WS","ROOT","DOC","WIN", code)`로 실행. WS=최상위의 WebSquare, ROOT=최상위 창, |
|  | DOC·WIN=getWindows()[0](=최상위). 오류는 `alert("런처 실행 오류: …")`(L3096-3110). 샌드박스·비동기 처리·시간 제한 없음 |
| 직링크 만들기 | `scanControls`가 모든 프레임의 단추·입력·링크·w2 컴포넌트를 훑어 `collectorEvents`에 kind=control로 쌓는다. 한 번에 700개까지, **스캔마다 |
|  | 새 행**(L1269-1289) |
| 직링크 내용 | directRef: menuKey(`history.state.data.menuCangVal`), componentId, elementId, componentType, value, |
|  | text, title, domChecked. 이 값을 박아 넣은 `javascript:` 한 줄 링크(L1157-1165, L1208-1210) |
| 직링크 실행 | 현재 메뉴가 menuKey와 다르면 메뉴 컨트롤러(`gfnOpenMenu`를 가진 객체, 창 속성·프레임 재귀 탐색)로 이동 → 200ms마다 최대 40번(8초) 대상 컴포넌트를 찾는다. |
|  | 클릭형(radio·checkbox·trigger·button·tab·link)은 click, 입력형은 setValue+input/change 이벤트(L1211-1268) |
| 직링크 화면 | 수집 관리자 직링크 탭: 검색 칸(이름·컴포넌트 id·종류·화면키), `현재화면 스캔`, 카드(이름+실행+복사). 같은 controlKey\|componentId\|label은 한 번만, |
|  | 최근 250개를 거꾸로(L4060-4104) |
| 숨은 규칙 | controlKey = 해시(menuKey, 동적 id 정규화, index 속성, 종류, title). 동적 id는 `wq_uuid_숫자_`→`wq_uuid_*_`, 6자리 이상 숫자 |
|  | 꼬리→`_*`(L1066). 입력 칸의 현재 **값**이 링크와 이벤트에 그대로 들어간다(자료 규칙 주의) |
| 옮길 때 걸리는 점 | SPEC `dict_screen.link`·`options`(S120)가 자리다. 스캔 결과를 DB에 쌓지 말고 요청 때 |
|  | 계산하면 700행×스캔 누적이 사라진다. 런처의 `new Function`은 MV3 확장 안에서 CSP로 막힐 수 있다: |
|  | **미확인**(이 저장소에 실측 없음) |

## 3. DB 브라우저
| 항목 | 내용 |
|---|---|
| 테이블 정의 | `tableRegistry`: id, name, physical, pk[], kind(fixed\|custom), createdAt, 사용자 정의는 description, |
|  | businessKeys[], collectionRule\|null, updatedAt. 고정 9개(접수·접수물품·입찰·입찰물품·계약·계약물품·연락처·분류번호·업무메모)의 pk 목록은 L110. |
|  | 사용자 id는 `dataset.<uuid>` |
| 행 | `tableRows`: id=`테이블id::행키`, tableId, rowKey, data{}, __storeVersion, createdAt, updatedAt, sourceMeta. 행키 = |
|  | 업무키 값을 `\|`로 이음, 사용자 테이블에 업무키가 없으면 data.__rowId(`row_<uuid>`)(L759-781) |
| 화면 | 창 1180×700: 왼쪽 테이블 선택 목록(22줄, 검색 없음)+`테이블 추가`·`칼럼 추가`·`EXPORT`·`테이블 설정` / 오른쪽 빠른 탭 줄+`+`, 머리(이름·N행·`+ 행`), 표 |
|  | 555px(L3272-3423) |
| 목록 구성 | 통합 뷰(가상) → tableRegistry(고정 먼저, 이름 ko순) → 시스템 15개(L3184-3195). 빠른 탭 기본값은 통합 뷰만, 선택한 테이블은 자동으로 빠른 탭에 추가되고 |
|  | **빼는 UI는 없다**(L3305) |
| 검색 | 0.6의 SmartGrid 검색·열 필터. 코어 쪽이 아니라 메모리 전부를 훑는다 |
| 셀 편집 | 업무·사용자 테이블: 행별 큐 → 한 트랜잭션에서 값 바꾸고 행키를 다시 계산해 id를 옮김. 새 행키가 다른 행과 겹치면 "변경한 업무키가 기존 행과 충돌합니다" 오류, 식별키가 비면 |
|  | "필수 식별키가 없습니다"(L3212-3265). 시스템 테이블: 객체를 통째로 put, 검증 없음(L3266-3271). 통합 뷰: 편집 불가 |
| `+ 행` | 사용자(dataset) 테이블만: 보이는 열을 빈 글자로 채운 행을 upsert. 업무키 값이 비면 오류 alert. 고정 테이블은 "붙여넣기 또는 추출 저장을 사용하세요" |
|  | alert(L3373-3386) |
| 칼럼 추가 | 창 470×460: 테이블·원본 Key·표시명·종류(string·numeric·integer·date·datetime·boolean)·너비·표시. 저장 = dictKeys 덮어쓰기(같은 |
|  | 키의 기존 라벨·종류가 **바뀐다**) + tableColumns(`테이블::키`, width 기본 130, order 9999)(L3471-3502) |
| 숨은 규칙(열) | 표의 열은 **행 데이터의 키 합집합**이다. 행이 하나라도 있으면 새 열은 그 키를 가진 행이 생길 때까지 안 보인다. 행이 0개일 때만 tableColumns로 열을 |
|  | 만든다(L3347-3359) |
| 열 상태 저장 | tableColumns의 visible·width·order 필드는 있으나 **칼럼 추가 때만** 채워진다. 끌어서 폭·순서를 바꾸는 UI와 숨기기 UI가 없다(order는 늘 |
|  | 9999). 보이기/숨기기는 사전의 숨김 키 탭(4절)이 유일하다 |
| 테이블 추가 | 창 500×570: 테이블명·설명·업무키(쉼표)·"현재 화면 조건을 기본 수집조건으로"+조건 편집. 이름이 비면 아무 일도 안 일어난다. pk는 업무키 없으면 |
|  | `["__rowId"]`(L848-854, L3445-3470) |
| 테이블 설정 | 창 550×650: 이름·설명·업무키·화면조건. 저장해도 **기존 행의 행키는 안 바뀐다**. 고정 테이블도 열리지만 pk는 FIXED_MAP이 우선(L3536-3569, L749) |
| EXPORT | JSON(`{table, exportedAt, rows}`) 또는 CSV(BOM, 머리는 원본 키, 행 키 합집합). 화면의 검색·필터와 무관하게 **전체 행**, 숨김 키 포함. `"` |
|  | `,` 줄바꿈만 따옴표 처리(L3503-3535) |
| 요약 카드 | DB 탭 아래: 업무/사용자 테이블 수·행 수·메모/일정 수·수집 이벤트 수(전부 dbAll로 센다)(L3176-3183) |
| 안 쓰이는 코드 | `deleteDataset`(L855)과 `dbClear`(L230)는 정의만 있고 부르는 곳이 없다. 사용자 테이블 삭제 UI는 없다 |
| 옮길 때 걸리는 점 | 열은 사전이 정한다(AGENTS)는 지금 원칙과 "행 키 합집합이 열"인 v4.2는 반대다. `칼럼 추가`·사용자 테이블은 `user_column`(빈 테이블, S96)과 쓰기 |
|  | 405(S63) 해제가 함께 결정돼야 한다 |

## 4. 사전 관리 7탭
창 1080×680, 위 탭 줄 + 오른쪽 추가 단추(`+ KEY`·`+ CODE`·`+ HEADER`·`+ 관계`·`+ 조건`·`+ 항목`)(L3603-3746).
표 높이 560px, 편집은 즉시 저장하고 저장 뒤 사전 캐시를 다시 읽는다(L3646).
| 탭 | 저장 구조 | 화면·동작 |
|---|---|---|
| 키 라벨 | dictKeys `{id=key, key, label, type, updatedAt}` | 세 열 모두 편집. `+ KEY`: Key·라벨·Type |
| 코드 값 | dictCodes `{id=키::값, key, value, label, discovered?}` | 세 열 편집. `+ CODE`: Key·원본 값·표시값 |
| 숨김 키 | dictExcluded `{id=key, key, excluded:true}` | 키 전체 목록의 hidden 칸(true·1·y·yes·✓) 편집 |
| 헤더 | dictHeaders `{id=테이블::키, tableId, key, label}` | 세 열 편집. `+ HEADER`: 테이블(`*`=전역)·Key·Header |
| 관계 | relationships `{id, name, from/to 테이블·키, enabled}` | 6열 편집. `+ 관계`: 이름·From/To 테이블·키 |
| 화면정보 | screenRegistry | 읽기 전용 9열(키·주소·코드 4개·이름·처음/마지막 시각) |
| 화면관리 | notes(screen), collectionSources | 하위 탭 메모/테이블: 조건 요약+`조건 수정`(L3694-3744) |

숨은 규칙:
- 종류(type)는 자유 글자다: string·numeric·integer 등, 자동 발견은 typeof 값. 시드 키 141개·종류 29개(L235-243).
- key·value·tableId 칸을 고쳐도 id는 안 바뀐다. id와 내용이 어긋날 수 있다(L3641-3688).
- 시드는 없을 때만 넣는다: 코드 17키 41값, 숨김 28개(빈 문자열 포함), 관계 2개(입찰→접수, 계약→입찰).
- 새 값은 저장 때마다 자동 발견: 키는 라벨=키로, 이름이 `Cd`로 끝나는 키의 값은 뜻=값 코드로(L738-748).
- `+ 항목`(숨김 키·화면정보)은 "기존 항목을 편집합니다" 토스트, `+ 조건`은 토스트 뒤 창 닫기(L3747-3835).
- 어느 탭에도 삭제 단추가 없다(숨김 키는 칸 편집으로 지움). 관계 표는 통합 보기가 읽지 않는다(7절).

옮길 때 걸리는 점:
- 지금 사전은 dict_key·dict_alias·dict_label(scope)·dict_code·dict_screen·dict_child(S114~129)라 7탭과 1:1이 아니다.
- 헤더 ≈ dict_label(scope=screen), 숨김 키 ≈ dict_key.display(결정 10), 관계 ≈ 빈 dict_relation(S96).
- HTTP는 POST·PATCH·PUT이 열려 있으나(S63) 삭제 경로가 없다. seed/*.json과 UI 편집이 어긋나지 않게 정할 일이다.

## 5. 수집 관리자·자동수집
| 항목 | 내용 |
|---|---|
| 저장 구조 | rawSessions: sessionId, startedAt, endedAt, status(RUNNING·STOPPED·INTERRUPTED) |
|  | rawCaptures: sessionId, eventType(START·SNAPSHOT·STOP), seq, capturedAt, trigger, screenKey, screenHash, url, |
|  | areaCd, depth1~3, hash, raw, manual. collectorEvents는 아래 |
| 이벤트 9종 | control(스캔), action(click·change·Enter: eventType, framePath, componentId, label, trusted, value, |
|  | directRef), menu, submission, request(전송 방식·method·url·headers·본문 ≤100,000자), response(status·종류·길이·본문 |
|  | ≤500,000자), snapshot(hash·sourceCount·projection 통계), conflict(충돌 해결) (L1061-1065, L1300-1480) |
| 창 | "수집 관리자" 1160×700. 탭 이벤트·RAW·수집규칙·화면·직링크 + 오른쪽 시작/종료·`수집`·`Export`(L3971-4109) |
| 이벤트 탭 | 종류 단추(all·control·action·menu·submission·request·response·snapshot·conflict)→ 10열 |
|  | 표(kind·시각·라벨·종류·컴포넌트·method·url·status·화면키·값). 전부 읽어 1,000행만 그림 |
| RAW 탭 | SNAPSHOT만, 11열 요약(시각·세션·trigger·화면키·주소·코드·hash·소스 수). **raw 본문을 보는 화면은 없다**(Export JSON으로만) |
| 수집규칙 탭 | collectionSources 10열 읽기 전용+`+ 규칙`: 현재 화면 소스 고르기 → 규칙 편집(아래) |
| 규칙 편집 | 창 540×620: 대상 테이블·종류(pointInfo|Grid)·Frame path·Source ID·사용 체크·조건 편집·저장·`규칙 삭제`(확인) |
|  | 저장 필드: id(`map_<uuid>`), targetTable, screenKey, screenLabel, matchMode(rule), rule, framePath, |
|  | sourceType, sourceId, enabled, createdAt, updatedAt (L907-912) |
| 규칙 일치 | enabled이고 (rule이 있으면 조건 일치, 없으면 matchMode=depths는 코드 하나 이상 같음, 아니면 화면키·옛 키 같음). 대상 테이블에 collectionRule이 |
|  | 있으면 그것도 일치해야 함(L892-947) |
| 시작 | 남아 있는 RUNNING 세션을 INTERRUPTED로 바꾸고 새 세션(`<시각>_<난수4>`) → START 기록 → 후크 설치 → 컨트롤 스캔 → 강제 스냅샷 → 토스트(L1556-1577) |
| 자동 저장 트리거 | 문서 click·change(캡처 단계)·Enter keydown 700ms, DOM 변화 650ms, XHR/fetch 응답 500ms, 메뉴 |
|  | 이동(`gfnOpenMenu`·`gfnOpenMenuMove`) 800ms, 제출(`gfnExecute`) 900ms. **타이머 하나를 공유**해 마지막 트리거 하나만 스냅샷을 |
|  | 찍는다(L1290-1509) |
| 종료 | 마지막 스냅샷(강제 아님)→STOP 기록→세션 STOPPED→후크 전부 원복(L1578-1588). 패널 `종료`도 먼저 autoStop |
| 스냅샷 | collectRaw → 해시. 자동 중이고 화면키+해시가 직전과 같으면 건너뜀. 같은 화면키+해시의 SNAPSHOT이 이미 있으면 RAW 행은 안 넣되 **규칙 반영은 한다**(L1535-1555) |
| 수동 수집 | 강제 스냅샷+컨트롤 스캔+토스트 "수동수집 완료 · N개 소스"(L1589-1595) |
| 반영(upsert) | additive 병합: 새 값이 빔 → 기존 유지, 기존이 빔 → 채움, 둘 다 있고 다름 → 행마다 `confirm`(확인=새 값, 취소=기존)+conflict 이벤트. 안 |
|  | 바뀌면 버전 안 올림. 필수 식별키 없으면 그 행 실패(L787-837) |
| 모르는 키 | 저장 때 dictKeys(라벨=키)에 자동 추가, `Cd`로 끝나면 dictCodes에도(L738-748) |
| 추출 창 | 현재 화면 소스별 탭 표(값이 있는 열만)+대상 테이블 선택+`DB 저장`(staging 기록→한 행씩 upsert→alert "저장 n행·중복·충돌·실패")+`수집규칙 저장`. 표 편집은 |
|  | 메모리 사본에만(L3837-3914) |
| 상태 표시 | 패널 "RAW n · 이벤트 n · DB n행"과 ●/■ 배지. 갱신할 때마다 세 저장소를 **전부 읽는다**(L2281-2290) |
| Export | `{type:"G2B_COLLECTION_V4", version:4, exportedAt, sessions, captures, events}` → |
|  | `g2b_collection_<시각>.json`(L1596) |
| 숨은 규칙 | 이벤트·응답 본문이 제한 없이 쌓이고 지우는 UI가 없다(`dbClear`는 미사용). 보관은 RAW도 무제한(지금은 건당 5개, S90). 자동수집 중 request 후크가 모든 통신 |
|  | 본문을 저장하므로 개인·업무 값이 그대로 남는다 |
| 옮길 때 걸리는 점 | 지금 수집은 요청 한 번=capture 1행+메인 upsert(S66~73, S101~108)이고 충돌은 확인창 없이 덮는다(S105). 이벤트 로그·request/response |
|  | 본문은 대응 DB 테이블이 없다(구조 변경 승인). 자동 수집은 SPEC에 "자동 순회 안 함"만 있고 트리거 자동화는 결정이 필요(v42-gap 결정 7) |

## 6. 백업·복원 (L4122-4166)
| 항목 | 내용 |
|---|---|
| 화면 | 창 500×570: 저장소 15개 체크박스(전부 기본 선택)+`EXPORT`+`IMPORT`(숨은 파일 입력 .json) |
| 대상 | notes, launcherScripts, tableRegistry, tableRows, collectionSources, dictKeys, dictCodes, dictExcluded, |
|  | dictHeaders, tableColumns, screenRegistry, relationships, collectorEvents, rawCaptures, rawSessions. |
|  | **settings·staging·toolMemos는 빠짐** |
| 내보내기 | `{type:"G2B_TOOLBOX_V4_BACKUP", version:"4.2", exportedAt, <저장소>: [...]}` → 파일명 |
|  | `g2b_toolbox_v4_1_backup_<시각>.json`(이름은 4_1) |
| 가져오기 | 체크한 저장소 중 파일에 배열이 있는 것만, 행마다 put(같은 id는 덮어씀, 삭제 없음). type·version 검사 없음, 확인창 없음, 트랜잭션 없음(중간 실패 시 일부만 반영) |
| 끝난 뒤 | 사전 캐시 갱신, 토스트 "Import 완료", 창 닫기, 메모·런처·요약 다시 그림. 실패는 `alert("Import 실패: …")` |
| 숨은 규칙 | 체크박스가 가져오기에도 적용된다(일부만 복원 가능). 이벤트·RAW까지 한 JSON이라 크기 경고가 없다. 위치·스티커 같은 settings는 복원되지 않는다 |
| 옮길 때 걸리는 점 | 지금 백업은 `VACUUM INTO` 파일(S112)이고 가져오기가 없다. 저장소 단위 선택 복원은 DB 테이블 단위 복원과 다르다. 병합(put)이 아니라 교체(복사본으로 |
|  | 갈아끼움)가 되는 점을 먼저 정해야 한다(v42-gap 결정 14) |

## 7. 통합 보기 (접수·입찰·계약)
| 항목 | 내용 |
|---|---|
| 계산 | 세 업무 테이블의 모든 행을 메모리에 읽어 이어 붙인다(L968-1039). 접수→입찰은 접수번호 키, 입찰→계약은 입찰공고번호 키로 **코드에 박힌 키**를 쓴다. 차수는 비교하지 않는다 |
| 행 만들기 | 접수마다: 입찰 없으면 접수만 / 입찰마다 계약 없으면 접수+입찰 / 계약마다 접수+입찰+계약 한 행. 그다음 접수 없는 입찰(+계약), 마지막으로 어디에도 안 쓰인 계약 |
| 열 이름 | 값 키 앞에 `receipt.`·`bid.`·`contract.`를 붙이고 라벨은 "접수·…"(0.7). 같은 이름 키가 세 단계에 있어도 안 겹침 |
| 화면 | DB 브라우저의 첫 항목 "통합 뷰"(읽기 전용, 편집 불가 안내 문구). 따로 만든 창 `openMasterWindow`(플랫/관계 트리)와 `buildRelationshipTree`는 |
|  | **부르는 곳이 없다**(L3570-3602, L1040) |
| 숨은 규칙 | `relationships` 저장소(시드 2개, 사전 탭에서 편집)는 계산에 안 쓰인다. 번호가 같은 차수가 여럿이면 곱해져 행이 늘어난다 |
| 옮길 때 걸리는 점 | 지금은 단계별 `g2b_receipt`·`g2b_bid`·`g2b_contract`와 라벨 뷰 `v_*`뿐이고 `dict_relation`은 비어 있다(S98, S204). |
|  | 접수번호가 입찰 테이블 컬럼(`as_column=1`)에 있어야 이을 수 있다. 읽기 전용 SQL 뷰로 둘지 뷰어 기능으로 둘지는 v42-gap 결정 17 |

## 8. 테마·설정
| 항목 | 내용 |
|---|---|
| 테마 | **선택 기능이 없다.** 어두운 색이 CSS에 박혀 있다(L1683): 패널 `#191c22`, 창 `#171a20`, 포인트 `#6f8cff`. 메모 카드·스티커만 6색 연한 팔레트. |
|  | SmartGrid 빈 줄무늬·편집 입력은 흰색으로 박혀 섞여 보인다(L1884, L2007) |
| 패널 | 폭 340, 최대 높이 84vh, 글꼴 맑은 고딕 12px. 탭 업무·메모/일정·런처·DB(수집 탭 단추는 만들지 않고 내용은 DB 탭에 합침, L2138, L3956) |
| 탭 조작 | 지금 탭을 다시 누르면 본문이 접힌다. 마지막 탭은 localStorage+settings에 저장(L2141-2166) |
| 위치 | 처음 left=창 폭−356, top=16. 화면 안으로 보정(아래쪽은 55px 남김). 끌기가 끝나면 저장, 창 크기가 바뀌면 다시 보정(L2167-2216, L4273) |
| 접기·종료 | — = 숨기고 46px 원형 G2B 버블(오른쪽 아래 16px). 종료 = 자동수집 정지, 후크·옵저버·창·스티커·패널·스타일 제거(L2224-2233, L4197-4254) |
| 중복 실행 | 같은 NS의 다른 버전이 살아 있으면 그것을 종료하고 새로 뜬다. 같은 버전이면 펼치기, 1.6초 안 두 번째면 위치 초기화+토스트(L2076-2092) |
| 설정 저장 | 사용자가 고르는 설정은 위 0.3 표가 전부다(접힘·열 목록·빠른 탭·스티커 위치). 환경 설정 화면은 없다 |
| 옮길 때 걸리는 점 | 확장은 `chrome.storage`에 토큰·설정만 둔다(S38)고 되어 있어 접힘·빠른 탭 같은 개인 설정의 자리를 정해야 한다. 뷰어 열 상태는 이미 `localStorage` |
|  | `viewer.columns.<테이블>`(S161). 다크 테마는 새 기능이다(docs/ref/ag-grid-community.md 참고) |

## 9. 이 문서가 확인하지 못한 것
- v4.2를 실제 화면에서 돌려 본 기록은 없다. 위는 코드를 읽은 결과이고 실행 동작은 미확인이다.
- `new Function` 런처가 확장 안에서 되는지, 달력 팝업이 남는지 등은 실측하지 않았다.
- 나라장터 쪽 함수 이름(`gfnOpenMenu`, `gfnExecute`)이 지금도 같은지는 이 저장소에서 확인하지 못했다.
