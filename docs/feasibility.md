# 0단계 가능성 시험 결과 (공개 화면, 로그인 없음)

- 측정일: 2026-10-28. 대상: https://www.g2b.go.kr 공개 화면. 값은 적지 않고 구조(개수·API 이름·화면 코드)만 적는다.
- 방법: 내장 브라우저에서 javascript로 WebSquare 컴포넌트를 읽고, 같은 확인을 `scripts/probe-public.mjs`(Playwright, msedge)로 4회 돌렸다. 아래 숫자는 마지막 실행(4회째) 기준이고 2~4회째 숫자는 모두 같았다.
- 다시 돌리기: `npm i --no-save playwright-core` 뒤 `node scripts/probe-public.mjs --out docs/feasibility-values/probe.json` (출력 폴더는 git 제외).
- 서버 예의: 스크립트가 일으키는 동작(이동·라디오·검색·탭) 사이는 1.5초 이상 띄운다. 단 메뉴 하나를 열 때 사이트가 스스로 `.do` 요청 4개를 동시에 보낸다(우리가 줄일 수 없음).

## 화면별 요약

발주계획과 사전규격공개는 **별도 메뉴가 아니다**. 둘 다 `발주 > 발주목록` 한 화면이고 검색유형 라디오(`radSrchTy`, ref `data:dlOderReqSrchM.srchTy`, 값 0001/0002)로 갈린다.

| 화면 | scrnNo | menuNo | menuCangVal | menuLvl | 화면 경로 | 그리드(보임/전체) | 그리드 헤더 라벨 | 입력폼 label[for] | 입력폼 라벨(어느 방식이든) |
|---|---|---|---|---|---|---|---|---|---|
| 발주계획 | 00963 | 13713 | PRCA001_04 | 2 | /ui/pr/prc/prca/OderReqL.xml | 1/1 | 26/27 (96%) | 18/24 (75%) | 24/24 (100%) |
| 사전규격공개 | 00963 | 13713 | PRCA001_04 | 2 | (같음) | 1/1 | 26/27 (96%) | 18/24 (75%) | 24/24 (100%) |
| 입찰공고목록 | 00941 | 01175 | PNPE001_01 | 3 | /ui/pn/pnp/pnpe/MyBidNtceL.xml | 1/8 | 111/111 (100%) | 74/185 (40%) | 185/185 (100%) |

- 그리드 헤더 라벨: 빠진 1개는 체크박스 열(`chk`, 헤더 값 false). `rowNum`의 헤더 "No"는 라벨로 셌다.
- 입력폼 라벨 방식별(발주목록 / 입찰공고목록): `label[for]` 18/24 · 74/185, 같은 행 `th` 23/24 · 174/185, `title` 속성 24/24 · 174/185. 셋 중 하나는 모두 붙는다.
- 입력폼 ref: 24/24, 175/185. 처음 보이는 입력은 4/24, 7/185(나머지는 "상세조건"을 펴야 보임).
- 발주목록 그리드는 열 27개 고정. 검색유형에 따라 보이는 열만 바뀐다(발주계획 11개, 사전규격공개 12개). 사전은 27열 전부를 가져야 한다.

## 항목별 결과 (PLAN.md 2절 0단계 1~9)

| # | 항목 | 결과 | API·근거 | 개수 |
|---|---|---|---|---|
| 1 | 화면 식별 | **조건부** | `history.state.data`의 scrnNo·menuNo·menuCangVal·menuLvl·upMenuNo·scrnSrcePathNm·menuCangSeCd·locToDown. URL은 늘 `/`(쿼리·해시 없음)라 URL로는 식별 안 됨. `areaCd`·`depth` 키는 없고 menuLvl이 깊이 역할. **발주계획·사전규격공개는 scrnNo가 같아** 화면 코드에 검색유형 값(`radSrchTy`)을 더해야 구분됨 | state 키 14개 |
| 2 | K-V-L | **됨** | 그리드: `getColumnCount`·`getColumnID(i)`(K), `getHeaderID(i)`→`getHeaderValue(hid)`·`getColIdByHeaderId(hid)`(L), `getAllJSON()`(V). `getHeaderIDArr()`는 빈 배열이라 쓰면 안 됨. 입력폼: `getRef()`(K), `label[for]`/`th`/`title`(L), `getValue()`(V). `label[for]`만으로는 40~75%, `th`·`title` 보조로 100% | 위 표 |
| 3 | 불필요 요소 제외 | **됨** | 전체 컴포넌트 중 ref 있는 것: 발주목록 35/971, 입찰공고목록 198/2,004 → ref 빈 것 제외가 기본값. 본문은 id 접두 `mf_wfm_container_`(159개, 960개)로 메뉴·머리말·바닥글과 갈린다. 반복 판별: 같은 `options.dataList`를 쓰는 그리드는 하나만(보이는 것 우선) — 입찰공고목록 `gridView1`·`gridView4`가 같은 dataList | 입력류 41·233개 중 ref 빈 것 8·37 |
| 4 | 보이는 것만/숨김 포함/전체 | **됨**(3모드 필요) | 본문 안 숨은 입력 중 값 있는 것: 발주목록 0, 입찰공고목록 68(기본값). 숨은 복제 그리드에 행 있음: 입찰공고목록 1개(`gridView4`). 보임 판정은 `getClientRects().length>0` | 0 / 68, 숨은 그리드 0 / 1 |
| 5 | 페이지 자동 순회 | **조건부** | `pageList`: `getCount`·`setCount`·`getSelectedIndex`·`setSelectedIndex`·`getPageSize`. 쪽 크기 select 10·30·50·100. 실제 쪽 넘김은 하지 않음(자동 조작 결정·기관 보안 확인이 먼저) | pageList 1개 / 8개 |
| 6 | 탭 자동 선택 | **조건부** | `tabControl`: `setSelectedTabIndex`·`getSelectedTabIndex`·`getTabCount`·`getTabInfo`. 발주목록은 탭 1개. 입찰공고목록은 탭 2개 중 "나의공고" 머리가 비로그인에서 숨겨져 있고 `setSelectedTabIndex(0)`은 **무시됨**(선택 1 유지, 요청 0). 공개 화면에는 전환 가능한 둘째 탭이 없어 실제 탭 전환은 확인 못 함 | 탭 1/1, 2(보임 1) |
| 6a | 탭(또는 조건)을 눌러야 조회되는 화면 | 아래 | 탭으로 조회가 갈리는 공개 화면은 없음. 대신: 발주계획은 열면 자동 조회. 사전규격공개는 라디오 변경(요청 0) 뒤 검색 버튼(요청 1)이 필요. 입찰공고목록은 열기만 하면 그리드가 비어 있고 검색 버튼(`..._btnS0004`)이 필요 | 3화면 중 검색 필요 2 |
| 7 | 테마(주입 CSS) | **됨 / 행 높이 조건부** | `:root` 변수 없음. 주입 `<style>`로: 글꼴 `body, body *{font-family:… !important}` → 그리드·label·input 모두 바뀜. 글자 크기 `.w2grid .gridBodyDefault{font-size}` 됨. 배경 `body{background-color}` 됨. 행 높이 `.w2grid .gridBodyDefault{height:28px !important}` → 한 줄 셀 그리드(발주목록) 40→28px 됨, 두 줄 셀 그리드(입찰공고목록, 두 줄 셀 43개)는 그대로 40px. 여기에 `padding 0`·`font-size 12px`·`line-height 14px`를 같이 주면 31px. 글꼴만 바꿔도 두 줄 셀 그리드는 40→42px로 커짐. `<style>`을 지우면 모두 원래대로 | 시험 5종 |
| 8 | 팝업 닫기·직링크 | **됨** | 팝업: `$p.getPopupList()` 4개 → `$p.closePopup(id)` 뒤 0개. 직링크: 전역 `gfnOpenMenu`는 없고 **`com.gfnOpenMenuMove(menuCangVal, opts, params)`**가 있음(`window.com`, 각 영역의 `*_com`에도 같은 함수). 두 메뉴(3화면) 모두 이 함수로 이동 확인. 메뉴 목록은 `_gcm.Global.getMenuDataList()`, 찾기는 `comUtil.gfnGetMenuInfo(scrnNo·menuNo·menuCangVal·이름)`. `com.gfnOpenMenu`는 첫 화면 적재용(세션 확인 포함)이라 직링크에 쓰지 않음. 함수 안에 menuCangSeCd 메020006이면 새 창, 2차 인증 메뉴면 인증 확인 분기가 있음 | 메뉴 498개, 이동 직후 1.5초 안 요청 4 |
| 9 | 로그인 업무 화면과의 차이 | **모름** | 로그인하지 않았다. 회사 PC에서 같은 스크립트를 한 번 더 돌린다. 이미 보이는 차이 후보: 숨은 "나의공고" 탭·그리드 3개, 2차 인증 분기, 업무 화면의 프레임 구성 | - |

기타: 공개 화면은 최상위 한 프레임(iframe 1개, WebSquare 없음).

## PLAN.md 선행 실측과 다른 점

- 탭: 선행 표의 "탭 2개, 전환 요청 0건"은 실제로는 숨은 "나의공고" 탭으로의 전환이 **무시된 것**이다. "숨은 탭의 그리드를 안 누르고 읽음"은 다른 탭이 아니라 같은 탭 안 숨은 복제 그리드(`gridView4`, 같은 dataList)다.
- 행 높이: 선행 표의 "40px 그대로"는 선택자 문제였다. `.w2grid .gridBodyDefault{height}`로 바뀌고, 두 줄 셀이 있는 그리드만 내용 높이가 하한이다.
- 글꼴: `body *`에 `!important`로 주면 깊은 요소까지 바뀐다.
- ref 빈 컴포넌트: 선행 표 1,989개 중 1,841개 → 이번 2,004개 중 1,806개. 같은 경향.

## 2단계로 미룰 것 후보 ("안 됨" 없음)

"안 됨" 항목은 없다. 조건부 항목은 1(사전규격 구분에 검색유형 필요), 5(자동 순회 결정 대기), 6(공개 화면에서 탭 전환 미확인), 7(두 줄 셀 행 높이). 9는 회사 PC 시험 전까지 모름.
