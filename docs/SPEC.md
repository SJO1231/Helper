# Helper 사양 (1단계)

현재 상태만 적는다. 바뀌면 본문을 고치고 docs/DECISIONS.md에 날짜·결정·이유 한 줄을 남긴다.

## 1. 목적
나라장터 업무 화면을 브라우저 확장이 K-V-L(키·값·라벨)로 읽고, 사전으로 이름을 바로잡아, 로컬 SQLite에 모으고,
엑셀처럼 읽기 전용 표로 보고 CSV·Excel로 내보낸다. DB는 로컬 코어 하나만 만지고, 확장과 뷰어는 코어 HTTP만 부른다.
컬럼은 화면이 아니라 사전이 정한다. 1단계는 공개 화면에서 "스냅샷 → 사전 → 저장 → 보기 → 내보내기"가 끝까지
도는 것이다. 공개 화면은 시험대이고, 회사 업무 화면은 회사 PC에서 제품을 쓰는 동안 그 PC의 DB에만 쌓인다.

## 2. 용어
| 용어 | 뜻 |
|---|---|
| 화면 | WebSquare 화면 하나. `history.state.data`의 menuNo로 가른다. URL은 늘 `/`라 쓰지 않는다 |
| 표 | 화면 위의 그리드(목록 표·하위 표). DB와 상관없는 화면 쪽 말이다 |
| 테이블 | SQLite 테이블. "표"와 섞어 쓰지 않는다 |
| K·V·L | 키(폼 ref, 그리드 열 ID)·값(원문 글자)·라벨(사람이 읽는 이름) |
| 표준키 | `dict_key`에 등록한 키. `as_column=1`이면 메인 테이블의 컬럼이 된다 |
| 사전 | `dict_*` 테이블. 키·라벨·코드·화면 넷이 중심이고 별칭·하위 표가 돕는다 |
| 단계 | receipt(접수)·bid(입찰)·contract(계약) 셋. 단계마다 메인 테이블 하나 |
| 업무키 | 한 단계 안에서 업무 1건을 가르는 값(번호·차수). 화면 사전의 key_fields가 정한다 |
| 스냅샷 | 지금 화면을 K-V-L로 읽어 표로 보여 주기. DB에 쓰지 않는다 |
| 수집 | 스냅샷 결과를 코어에 보내 저장하기. capture 1행 + 메인 upsert |

## 3. 폴더·경계·코드 규칙
| 폴더 | 하는 일 |
|---|---|
| `core/` | Python. `gateway.py`(DB의 유일한 접점), `service.py`(로컬 HTTP), `native_host.py`(Native Messaging) |
| `extension/common/` | 사이트를 모르는 부분: 리모컨 창, 스냅샷 창, 사전 적용, 코어 전송, 진단 줄 |
| `extension/sites/g2b/` | 나라장터만 아는 부분: 화면 식별, 추출 규칙 |
| `viewer/` | 읽기 전용 표와 CSV·Excel 내보내기. 확장 페이지(`viewer.html`)로 빌드되고 코어 HTTP만 부른다 |
| `shared/` | 메시지·사전 JSON 스키마와 TS 타입, `seed/*.json` |
| `scripts/` | 빌드·설치·검증·`e2e:public`·`bench:viewer`·공개 화면 probe |

- `sqlite3`를 import하는 파일은 `core/gateway.py` 하나뿐이다.
- extension·viewer는 core 내부를 import하지 않는다. 서로 나누는 것은 `shared/`만이다.
- 화면 코드·업무키·표 이름은 `dict_*` 데이터다. 화면 내용이 DB 구조를 바꾸는 길은 없다(바뀌는 것은 사전 승격뿐).
- 확장은 수집 자료를 `chrome.storage`에 두지 않는다(토큰·설정만). 설치 대상은 Chrome, e2e·bench는 Playwright Chromium.
- 코드 규칙은 AGENTS.md "만드는 규칙"(한 파일 한 일·300줄, 120자, 이름·주석, 폴더 밖 수정은 먼저 묻기)을 따른다.
- 확장 아이콘은 `scripts/icons.mjs`가 빌드 때 `dist/extension/icons/`에 생성한다(git 밖).

## 4. 메시지 계약 (확장·뷰어 ↔ 코어)

### 4.1 연결
- Native Messaging: `{"type":"hello"}` → `{"port","token","schema_version"}`. 서비스가 없으면 호스트가 띄운다.
  끝내 못 띄우면 `{"type":"request","method","path","headers","body"}`를 호스트가 gateway로 처리해 `{"status","body"}`.
- HTTP: `127.0.0.1:<port>`. 모든 요청에 `Authorization: Bearer <token>`, 없거나 틀리면 401. 뷰어도 확장의 토큰을 쓴다.
- 오류는 HTTP 상태와 `{"error":"<문장>"}`. 요청의 `X-Schema-Version`이 코어와 다르면 409.
- 쓰기 요청은 `X-Request-Id` 헤더가 있어야 한다. 같은 ID가 다시 오면 저장해 둔 응답을 그대로 준다.

### 4.2 경로 (Grist records 꼴)
| 경로 | 요청 | 응답 |
|---|---|---|
| `GET /api/tables` | - | `{"tables":[{"id","fields":{"label","stage","kind"}}]}` |
| `GET /api/tables/{t}/columns` | - | `{"columns":[{"id":"<std_key>","fields":{"label","type","index"}}]}` |
| `GET /api/tables/{t}/records` | `sort`·`filter`·`limit`·`offset` | `{"records":[{"id","fields":{...}}],"total":N}` |
| `POST /api/tables/{t}/records` | `{"records":[{"fields":{...}}]}` | `{"records":[{"id","fields":{...}}]}` |
| `PATCH /api/tables/{t}/records` | `{"records":[{"id","fields":{...}}]}` | `{"records":[{"id"}]}` |
| `PUT /api/tables/{t}/records` | `{"records":[{"require":{..},"fields":{..}}]}`, `noupdate` | `{"records":[{"id"}]}` |

- `sort`: `열,-열`(앞에 `-`면 내림차순). `filter`: `{"열":["값",...]}`(값 중 하나와 같음). Grist와 같다.
- `limit` 기본 500, 최대 5,000. `offset`은 Grist에 없는 덧붙임이다. 정렬·필터는 코어(SQLite)가 한다.
- 정렬은 `dict_key.type`대로: number·money·percent는 쉼표 등을 뗀 수, date·datetime은 숫자만 남긴 글자로 비교한다.
- 1단계에 쓰기가 되는 곳: `g2b_capture`에 POST(수집), `dict_*`에 POST·PATCH·PUT. 나머지 쓰기는 405.
- `{t}`의 `columns` 라벨은 `dict_label` 우선순위(6절)를 적용한 결과다.
- `g2b_capture`는 읽기 전용 목록이다(라벨 수집 이력, raw 제외, sort가 없으면 최신 먼저). 쓰기는 수집 POST뿐이다.

### 4.3 수집
`POST /api/tables/g2b_capture/records`, 레코드 하나 = 수집 1회.
- 요청 fields: `site`, `menu_no`, `scrn_no`, `url`, `mode`, `raw`.
- raw: `{"state","param","pointInfo":[{"k","v","l","visible"}],"tables":[{"id","dataList","visible","columns","rows"}]}`
  `state`는 `history.state.data`에서 `param`을 뺀 스칼라, `columns`는 `[{"k","l"}]`.
- 응답 fields: `status`(same/new/changed/rejected), `record_id`, `stage`, `changed`(바뀐 표준키), `unknown_keys`, `reason`.
- 화면 사전에 stage가 없거나 업무키 값이 비면 `rejected`이고 아무 테이블도 바뀌지 않는다.

### 4.4 화면 자동 등록
확장은 `history.state.data`의 menuNo가 바뀔 때마다 `PUT /api/tables/dict_screen/records?noupdate=true`를 보낸다.
`require`는 `{site, menu_no}`, `fields`는 `{scrn_no, menu_cang_val, name}`(name은 menuNm). 이미 있으면 그대로.
실패하면 진단 줄에 "코어 꺼짐"만 띄우고 쌓아 두지 않는다.

## 5. DB 테이블·컬럼 (A안, 2026-10-28 승인)
SQLite 파일 하나. 접두어 `g2b_`가 사이트다. 다른 안과의 비교는 DECISIONS.md.

| 테이블 | 열 | 규칙 |
|---|---|---|
| `g2b_capture` | capture_id PK, record_id, screen_code, url, captured_at, raw_hash UNIQUE, raw | 수집 1회 = 1행 |
| `g2b_receipt`·`g2b_bid`·`g2b_contract` | 아래 고정 열 + 표준키 컬럼 | 업무 1건 = 1행 |
| `g2b_<stage>_item` | record_id, line_no, raw_line(JSON) + 물품 표준키 컬럼 | `dict_child.alias`가 `item`인 표 |
| `g2b_<stage>_child` | record_id, table_code, line_no, raw_line(JSON) | 그 밖의 하위 표. 인덱스 (record_id, table_code) |

- table_code는 그리드의 dataList 이름이다(그리드 id는 `wq_uuid_N_`처럼 바뀐다). `dict_child`에 없는 표도 child에 넣는다.
- capture: screen_code는 menu_no. 같은 raw_hash면 넣지 않는다. 건당 최근 5개를 보관한다(설정).
- 메인 고정 열: record_id PK(해시 아님, 아래), key1, key2, latest_capture_id, captured_at, screen_code,
  store_version, deleted_at(휴지통), user_values(JSON). record_id는 key_fields에 적힌 키 값만 `|`로 잇는다(`번호|차수`,
  키 하나면 `번호`로 끝나고 빈 꼬리를 남기지 않는다).
- 표준키 컬럼: `as_column=1`인 표준키가 `stages`에 든 테이블마다 TEXT 1열. 값은 원문 글자('00'·0·false 보존). `index=1`이면 인덱스.
- raw_hash는 `raw`를 키 정렬한 JSON의 SHA-256이다. captured_at은 raw에 넣지 않는다.
- 사전(6절): `dict_key`·`dict_alias`·`dict_label`·`dict_code`·`dict_screen`·`dict_child`, 빈 `dict_relation`·`user_column`.
- 공통: `request_log(request_id PK, fingerprint, response)`, `schema_version(module PK, version)`, `settings_*` 2개.
- 공개 뷰 `v_receipt`·`v_bid`·`v_contract`: 라벨을 열 이름으로 쓴 읽기 전용 뷰. 바깥 소비자는 뷰만 읽는다.
- 하위 표 승격: `dict_child.typed=1`이면 `g2b_<stage>_<alias>` 컬럼형 테이블로 child 행을 옮긴다. 되돌림은 반대.

### 5.1 쓰기 한 번의 순서 (한 트랜잭션)
1. request_log에 같은 request_id가 있으면 저장된 응답을 그대로 돌려준다.
2. 화면 사전으로 stage·업무키를 정하고 record_id를 만든다. 없으면 rejected. alias로 K를 표준키로 바꾼다.
3. raw_hash가 이미 있으면 same으로 끝(메인 captured_at만 갱신). 없으면 capture 1행.
4. 메인 upsert. 확인창 없이 덮어쓰되 화면 값이 빈 칸은 DB 값을 지우지 않는다. 바뀐 표준키를 응답 changed에 넣고,
   확장은 "바뀐 칸 n개" 알림을 띄운다.
5. 물품·child는 그 record의 그 table_code 행을 지우고 다시 넣는다. 화면 표가 비어 있으면 그대로 둔다.
6. store_version +1, request_log 기록.

### 5.2 구조 변경과 운영
- 키 승격(`as_column` 0→1)은 `ADD COLUMN`과 raw로 과거 행 채우기를 한 트랜잭션으로. 되돌림은 `DROP COLUMN`(raw에 값 남음).
- WAL, busy_timeout, 프로세스 안 RLock, `executescript` 쓰지 않음. 백업은 `VACUUM INTO`.

## 6. 사전 4개의 필드
| 사전 | 필드 | 규칙 |
|---|---|---|
| `dict_key` | std_key PK, module, stages, type, label, as_column, index, derived, display | 이름은 아래 |
| `dict_label` | scope(user/screen/site/system), scope_id, key, label | 우선순위 user > screen > site > system |
| `dict_code` | std_key, code, meaning, scope | V가 코드일 때 뜻 |
| `dict_screen` | site, menu_no, scrn_no, menu_cang_val, name, stage, source_route, key_fields, link, options | 아래 |

- std_key 이름은 나라장터 필드 ID 그대로(camelCase, 가장 흔한 꼴 하나). 화면별 변형은 alias, 우리가 만든 키만 snake_case.
- dict_key.stages: JSON 배열, 값은 receipt·bid·contract 또는 `<단계>_item`. 열은 `g2b_<값>` 테이블에만 생긴다.
- dict_key.type: text·number·money·percent·date·datetime·bool·code. 뷰어가 이 타입으로 값을 해석한다.
돕는 사전:
- `dict_alias(site, screen_code, source_key, std_key)`: K를 표준키로 모은다. screen_code가 비면 모든 화면.
  source_key에는 `param.<키>`도 올 수 있다.
- `dict_child(site, table_code PK, alias, stage, typed, key_fields)`: 하위 표의 이름과 승격 여부.

화면 사전 규칙:
- 화면 키는 (site, menu_no)다. 검색유형(`radSrchTy`)은 키에 넣지 않고 raw에만 남겨, 발주계획·사전규격 목록(13713)은 한 행이다.
- 상세 화면은 목록과 menu_no가 달라 각자 한 행이다. 목록 행이 어느 상세로 가는지는 적지 않는다.
- 처음 보는 화면은 stage가 빈 채로 자동 등록된다(4.4). stage가 빈 화면은 스냅샷만 되고 수집 버튼이 꺼진다.
- key_fields는 표준키 1~2개의 JSON 배열이고 차례로 key1·key2가 된다.

해석 순서: K → `dict_alias`(그 화면 것 > 전체) → 없으면 K 또는 K의 마지막 `.` 뒤 이름이 `dict_key`에 있으면 그 표준키
→ 라벨(우선순위, 없으면 화면 L) → type. 표준키를 못 찾은 K는 "미등록 키"로 센다.

## 7. 추출 규칙
- 본문은 `#mf_wfm_container` **안**(DOM 포함 관계)이다. id 접두어로 자르지 않는다(첨부파일 그리드 id가 다르다).
- 모드 3개: 보이는 것만(본문 안·`getClientRects().length > 0`), 숨김 포함(본문 안 전부), 전체(문서 전체).
  스냅샷 기본은 보이는 것만. 수집은 리모컨에서 고른 모드로 읽고 기본은 보이는 것만. raw의 mode에 남긴다.
- 빈 ref 제외: 세 모드 모두 ref가 빈 폼 컴포넌트를 뺀다.
- 같은 dataList 그리드는 하나만(스냅샷·수집 공통): `options.dataList`가 같으면 보이는 것, 둘 다 같으면 문서 순서 첫 것.
- 그리드: `getColumnCount`·`getColumnID(i)`가 K, `getHeaderID(i)`→`getHeaderValue(hid)`가 L, `getAllJSON()`이 V.
  `getHeaderIDArr()`는 쓰지 않는다. `getAllJSON()`이 실패하는 그리드(예: 개찰결과 `gridGangwon`)는 건너뛰고 진단 줄 수에 넣는다.
- 폼: K는 `getRef()`에서 `data:`를 뗀 `<dataMap>.<키>`, V는 `getValue()` 원값(`input.value` 아님).
  모든 값은 원문 글자 그대로 보낸다. 서식을 풀거나 숫자로 바꾸지 않는다.
- 라벨: `label[for]` → 바로 앞 칸 `th` → 같은 행 `th` → `title` 속성 차례로, 처음 찾은 것을 쓴다.
- param: `history.state.data.param`의 스칼라는 K `param.<키>`, 객체는 한 단계만 `param.<객체>.<키>`로 편다.
  더 깊은 것과 배열은 버리고 진단 줄의 수에 넣는다.
- 프레임 합치기: WebSquare(`$p`)가 있는 모든 프레임에서 읽어 하나로 합친다. 같은 K가 겹치면 보이는 쪽,
  둘 다 같으면 최상위 프레임에 가까운 쪽을 쓴다. 공개 화면은 프레임이 하나라 vitest 구조 fixture로 시험한다.
- 로딩 중: `#__processbarIFrame`이 보이면 200ms마다 다시 보고 최대 10초 기다린다. 넘으면 "불러오는 중"으로 거절한다.
- 진단 줄: 읽은 폼·그리드 수, 뺀 수(빈 ref·같은 dataList·실패 그리드·버린 param), 미등록 키 수, 코어 연결 상태.
- 리모컨 −1년/+1년: 보이는 시작일·끝일 첫 쌍을 찾아 시작일의 해 ±1로 정하고, 두 칸을 그 해 1월 1일·12월 31일로
  바꾼다. 기간 칸은 값이 YYYYMMDD인 보이는 `input`이다. 조회 버튼은 누르지 않는다. 조회건수: 10·30·50·100·250·500·1000 또는 직접 입력한 값을 쪽 크기로 넣는다.
  select에 없는 값이면 option을 더하고 컴포넌트 `addItem` 뒤 `setValue`(글자 값만 먹는다)를 부르고, 쪽 목록 `setPageSize`로 쪽 크기를 맞춘다(S3 실측).
- 조회·엑셀 버튼: 리모컨이 화면의 버튼(a·button·input 버튼·role=button)을 글자로 찾아, WebSquare 컴포넌트가 있으면 trigger('onclick'), 없으면 click()으로 누른다. 못 찾으면 실패 알림.
- 패널 위치·접힘: `chrome.storage.local`의 `remotePanel`에 저장하고 다시 붙을 때 복원한다.
- 패널은 업무·수집·뷰어 탭으로 묶이고 마지막 탭도 `remotePanel`에 저장한다. 종료(×)는 그 페이지 로드 동안 재부착을 멈춘다. Alt+G 접기·펼치기, Alt+Shift+G 위치 초기화.
- 뷰어 열 폭·순서·숨김: `localStorage`에 테이블별로 저장한다(정렬·필터는 저장하지 않는다).
- 코드 열 뜻 표시: 화면에만 보인다. 정렬·필터·내보내기는 원값이다.

## 8. 1단계 끝 기준
아래 명령을 돌려 모든 문장이 참이면 1단계가 끝난다. 실패·미실행·대상 0건은 참이 아니다.

**`pytest core/tests`가 모두 통과한다.** 그 안에 이 시험이 있다.
- 같은 raw_hash를 두 번 넣으면 `g2b_capture`는 1행이다.
- 같은 업무키에 다른 raw_hash를 넣으면 `g2b_capture`는 2행, 메인은 1행이다.
- 화면 값이 빈 칸으로 다시 수집해도 메인의 그 칸 값은 그대로다.
- 같은 `X-Request-Id`로 두 번 보내면 응답이 같고 capture는 1행이다.
- `dict_key.as_column`을 0→1로 바꾸면 컬럼이 생기고 과거 행이 raw에서 채워진다.
- 메인 10,000행에서 records 한 쪽(500행)이 1초 안에 온다.
- `core/` 아래에서 `sqlite3`를 import하는 파일은 `core/gateway.py` 하나다.

**`npm run verify`(tsc·vitest·빌드)가 오류 0으로 끝난다.**

**`npm run e2e:public`이 종료 코드 0으로 끝난다.** Playwright로 빌드한 확장·코어를 띄워 공개 나라장터에서 돌리고 기준마다
`{"기준":true/false}`를 출력한다(false면 종료 코드 1, 빈 DB로 시작, 동작 사이 1.5초 이상, CI 밖).
시작 때 시험 배정(stage·key_fields·alias)을 넣는다: 발주계획상세(01033)→receipt, 입찰공고상세(통합)(01196)→bid, 사전규격상세(01141)→contract.
- 상세 3개를 각각 10번 수집하면 `g2b_receipt`·`g2b_bid`·`g2b_contract`가 각 1행, `g2b_capture`가 3행이다.
- 입찰공고목록(01175)을 두 번 열면 `dict_screen`에 (g2b, 01175)가 1행이다.
- 발주계획·사전규격공개(13713)·입찰공고목록(01175)의 스냅샷 표 열 머리가 6절 해석 순서의 라벨과 같고,
  스냅샷 전후 DB의 모든 테이블 행 수가 같다.
- 진단 줄에 빈 ref 제외 수와 미등록 키 수가 숫자로 보인다.
- 입찰공고목록에서 −1년을 누르면 첫 기간 칸 쌍이 (시작일의 해−1)년 1월 1일~12월 31일이 되고 조회 요청은 0건이다.
- 입찰공고목록에서 조회건수 100을 고르면 보이는 그리드의 쪽 크기가 100이다.
- 뷰어에서 내보낸 xlsx·CSV의 첫 행이 그 테이블의 `columns` 라벨과 같다.
- 입찰공고목록에서 리모컨 「조회」를 누르면 2초 안에 조회 요청이 1건 이상 나가고 토스트가 실패 문구가 아니다.
- 입찰공고목록에서 리모컨 「조회」 응답이 오고 그리드가 다시 그려진 뒤 「엑셀」을 누르면 2초 안에 다운로드가 시작된다(받은 파일은 저장하지 않고 취소한다. 사이트 안내창이 뜨면 거짓).
- 리모컨 제목 줄을 끌어 옮기고 접은 뒤 새로 고치면 접힌 버블이 옮긴 자리(±8px)에 있다(끝나면 다시 펼친다).
- 뷰어(`g2b_bid`)에서 첫 열 폭을 60px 끌어 넓히고 새로 고치면 폭이 유지된다(±4px).

**`npm run bench:viewer`가 종료 코드 0으로 끝난다.** 빈 DB의 `g2b_bid`에 넣은 합성 자료 1,000행×100열과 10,000행×100열 모두에서:
- 뷰어의 열 수가 `stages`에 bid가 든 as_column=1 표준키 수와 같다.
- 뷰어 페이지 이동 시작부터 첫 쪽 행이 그려질 때까지 1초 안이다.
- 정렬과 필터가 각각 300ms 안에 끝난다(코어 왕복 포함).
- 열 타입 변경이 500ms 안에 끝난다(bench가 뷰어의 열 정의를 바꿔 다시 그리기까지. 저장 안 함, 코어 제외).
- 마우스 휠로 세로 끝까지·가로 끝까지 훑는 동안 프레임 간격의 90% 이상이 17ms(60Hz 한 프레임 16.7ms + 측정 오차) 안이다.

## 9. 하지 않는 것
- 사전규격 단계·테이블. 절차상 제외다. 공개 사전규격 화면은 수집 흐름 시험에만 쓴다.
- 목록 행 수집(목록 화면은 스냅샷만), 화면 사전을 파일로 내보내거나 가져오기.
- 자동 순회(쪽 넘김)·탭 순회. 연계기관 공고가 첫 쪽에 없을 때 쪽 넘김으로 찾기도 안 한다("나중"에서 옮김).
- 공개 화면 값을 fixture에 넣기(fixture는 구조만), 공개 시험 화면의 stage를 제품 seed에 넣기.
- 뷰어 편집·사용자 열 편집·자체 그리드 편집기.
- 2단계 이후 기능: 확장 없이 뷰어 열기, 직링크·팝업 닫기·간단 스크립트·메모·일정·테마, 템플릿, 엑셀 연동, 트레이,
  `dict_relation`·사용자 표의 내용, memo·schedule 테이블.
