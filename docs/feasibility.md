# 0단계 가능성 시험 결과 (공개 화면, 로그인 없음)

- 측정일: 2026-10-28. 대상: https://www.g2b.go.kr 공개 화면.
- 값은 적지 않고 구조(개수·API 이름·화면 코드)만 적는다.
- 방법: 내장 브라우저에서 javascript로 WebSquare 컴포넌트를 읽어 확인한 뒤,
  같은 확인을 `scripts/probe-public.mjs`(Playwright, msedge)로 돌렸다.
- 숫자 기준: 목록만 본 1차 4회, 상세를 넣은 2차 6회 실행. 아래 숫자는 2차 마지막 실행 기준이다.
  2차 2~6회째는 문서 전체 컴포넌트 수(±1)와 발주계획상세의 처음 보이는 ref 수(22~23, 첫 행 자료에 따라)만 빼고 같았다.
- 같은 날 늦게 3차 4회를 더 돌렸다(그사이 목록 첫 행이 바뀜). 목록 표와 상세의 전체·라벨 수는 10회 모두 같았다.
  상세에서 **보이는** 그리드·ref 수만 누른 행에 따라 달랐다. 그래서 상세 표의 보임 칸은 10회 범위로 적는다.
- 2차에서 "본문" 판정을 id 접두어(`mf_wfm_container_`)에서 DOM 포함 관계(`#mf_wfm_container` 안)로 바꿨다.
  첨부파일 그리드처럼 본문 안에 있어도 id가 `wq_uuid_N_`로 시작하는 컴포넌트가 있어서다.
  그래서 목록의 입력폼 숫자가 1차 기록보다 커졌다(발주목록 24→33, 입찰공고목록 185→225).
- 다시 돌리기: `npm i --no-save playwright-core` 뒤
  `node scripts/probe-public.mjs --out docs/feasibility-values/probe.json` (출력 폴더는 git 제외).
- 서버 예의: 스크립트가 일으키는 동작(이동·라디오·검색·탭·셀 클릭·뒤로) 사이는 1.5초 이상 띄운다.
  단 화면 하나를 열 때 사이트가 스스로 `.do` 요청 1~18개를 동시에 보낸다(우리가 줄일 수 없음).
- 누른 것: 메뉴, 검색유형 라디오, 검색 버튼, 목록의 링크 셀, 브라우저 뒤로가기. 등록·제출·삭제·다운로드는 누르지 않았다.

## 화면별 요약 (목록)

발주계획과 사전규격공개는 **별도 메뉴가 아니다**. 둘 다 `발주 > 발주목록` 한 화면이고
검색유형 라디오(`radSrchTy`, ref `data:dlOderReqSrchM.srchTy`, 값 0001/0002)로 갈린다.

| 화면 | scrnNo | menuNo | menuCangVal | menuLvl | 그리드 보임/전체 | 그리드 헤더 라벨 | 폼 label[for] | 폼 라벨(아무 방식) |
|---|---|---|---|---|---|---|---|---|
| 발주계획 | 00963 | 13713 | PRCA001_04 | 2 | 1/1 | 26/27 | 21/33 (64%) | 33/33 |
| 사전규격공개 | 00963 | 13713 | PRCA001_04 | 2 | 1/1 | 26/27 | 21/33 (64%) | 33/33 |
| 입찰공고목록 | 00941 | 01175 | PNPE001_01 | 3 | 1/8 | 111/111 | 82/225 (36%) | 225/225 |
| 개찰결과분류조회 | 02117 | 01522 | PBOC006_01 | 3 | 1/1 | 8/8 | 6/14 (43%) | 14/14 |

- 화면 경로(scrnSrcePathNm): 발주목록 `/ui/pr/prc/prca/OderReqL.xml`, 입찰공고목록 `/ui/pn/pnp/pnpe/MyBidNtceL.xml`,
  개찰결과분류조회 `/ui/pb/pbo/pboc/OnbsRsltClsfInqyL.xml`.
- 그리드 헤더 라벨: 빠진 1개는 체크박스 열(`chk`, 헤더 값 false). `rowNum`의 헤더 "No"는 라벨로 셌다.
- 폼 라벨 방식별(발주목록 / 입찰공고목록): `label[for]` 21/33 · 82/225, 같은 행 `th` 32/33 · 214/225,
  `title` 30/33 · 190/225. 셋 중 하나는 모두 붙는다.
- 폼 ref: 28/33, 191/225. 처음 보이는 입력은 6/33, 9/225(나머지는 "상세조건"을 펴야 보임).
- 발주목록 그리드는 열 27개 고정. 검색유형에 따라 보이는 열만 바뀐다(발주계획 11개, 사전규격공개 12개).
  사전은 27열 전부를 가져야 한다.
- 개찰결과분류조회는 공개 메뉴(`입찰개찰/낙찰 > 개찰결과분류조회`)로 연다. 열면 비어 있고 검색 버튼을 눌러야 조회된다.
  쪽 넘김 컴포넌트(pageList)가 없고 그리드 `onscrollend`로 더 읽는다.

## 항목별 결과 (PLAN.md 2절 0단계 1~9)

### 1. 화면 식별 — 조건부
- `history.state.data`의 scrnNo·menuNo·menuCangVal·menuLvl·upMenuNo·scrnSrcePathNm·menuCangSeCd·locToDown(키 14개).
- URL은 늘 `/`(쿼리·해시 없음)라 URL로는 식별 안 됨. `areaCd`·`depth` 키는 없고 menuLvl이 깊이 역할.
- **발주계획·사전규격공개는 scrnNo가 같다.** 화면 코드에 검색유형 값(`radSrchTy`)을 더해야 구분된다.

### 2. K-V-L — 됨
- 그리드: `getColumnCount`·`getColumnID(i)`(K), `getHeaderID(i)`→`getHeaderValue(hid)`·`getColIdByHeaderId(hid)`(L),
  `getAllJSON()`(V). `getHeaderIDArr()`는 빈 배열이라 쓰면 안 된다.
- 입력폼: `getRef()`(K), `label[for]`/`th`/`title`(L), `getValue()`(V).
  목록의 `label[for]`만으로는 36~64%, `th`·`title` 보조로 100%. 상세 화면은 `label[for]`가 0이다(아래 상세 절).

### 3. 불필요 요소 제외 — 됨
- 문서 전체 컴포넌트 중 ref 있는 것: 발주목록 35/971, 입찰공고목록 198/2,011 → ref 빈 것 제외가 기본값.
- 본문은 `#mf_wfm_container` 안(265개, 1,295개)으로 메뉴·머리말·바닥글과 갈린다. id 접두어로 자르면 첨부파일 그리드가 빠진다.
- 반복 판별: 같은 `options.dataList`를 쓰는 그리드는 하나만(보이는 것 우선).
  입찰공고목록 `gridView1`·`gridView4`, 입찰공고상세(통합) `gridDmstPic`·`gridDmstPicEvl`이 같은 dataList.
- 입력류 41·233개 중 ref 빈 것 8·37.

### 4. 보이는 것만/숨김 포함/전체 — 됨(3모드 필요)
- 본문 안 숨은 입력 중 값 있는 것: 발주목록 6, 입찰공고목록 106(대부분 기본값).
- 숨은 복제 그리드에 행 있음: 입찰공고목록 1개(`gridView4`). 상세 화면은 업무 구분에 따라 그리드를 숨긴다(상세 절).
- 보임 판정은 `getClientRects().length>0`.

### 5. 페이지 자동 순회 — 조건부
- `pageList`: `getCount`·`setCount`·`getSelectedIndex`·`setSelectedIndex`·`getPageSize`. 쪽 크기 select 10·30·50·100.
- pageList 개수: 발주목록 1, 입찰공고목록 8, 개찰결과분류조회 0(스크롤로 더 읽음).
- 실제 쪽 넘김은 하지 않았다(자동 조작 결정·기관 보안 확인이 먼저).

### 6. 탭 자동 선택 — 조건부
- `tabControl`: `setSelectedTabIndex`·`getSelectedTabIndex`·`getTabCount`·`getTabInfo`.
- 발주목록 탭 1개. 입찰공고목록 탭 2개 중 "나의공고" 머리가 비로그인에서 숨겨져 있고
  `setSelectedTabIndex(0)`은 **무시됨**(선택 1 유지, 요청 0). 상세 화면 5종에는 탭이 없다.
- 공개 화면에는 전환 가능한 둘째 탭이 없어 실제 탭 전환은 확인 못 했다.
- 탭으로 조회가 갈리는 공개 화면은 없다. 대신 조회 조건: 발주계획은 열면 자동 조회.
  사전규격공개는 라디오 변경(요청 0) 뒤 검색 버튼(요청 1). 입찰공고목록·개찰결과분류조회는 열면 비어 있고 검색 버튼이 필요.

### 7. 테마(주입 CSS) — 됨 / 행 높이 조건부
- `:root` 변수 없음. 주입 `<style>`로 시험 5종:
  - 글꼴 `body, body *{font-family:… !important}` → 그리드·label·input 모두 바뀜.
  - 글자 크기 `.w2grid .gridBodyDefault{font-size}` 됨. 배경 `body{background-color}` 됨.
  - 행 높이 `.w2grid .gridBodyDefault{height:28px !important}` → 한 줄 셀 그리드(발주목록·개찰결과분류조회) 40→28px.
    두 줄 셀 그리드(입찰공고목록, 두 줄 셀 43개)는 그대로 40px.
    여기에 `padding 0`·`font-size 12px`·`line-height 14px`를 같이 주면 31px.
  - 글꼴만 바꿔도 두 줄 셀 그리드는 40→42px로 커진다.
- `<style>`을 지우면 모두 원래대로.

### 8. 팝업 닫기·직링크 — 됨
- 팝업: `$p.getPopupList()` 4개 → `$p.closePopup(id)` 뒤 0개.
- 직링크: 전역 `gfnOpenMenu`는 없다. `window.com`(각 영역 `*_com`에도 같은 함수)에 두 가지가 있다.
  - `com.gfnOpenMenuMove(menuCangVal, opts, params)`: 바로 이동. 목록 3화면을 이것으로 열었다.
  - `com.gfnOpenMenu(menuCangVal, {isHistory, param}, searchInfo)`: 세션 확인 뒤 `gfnOpenMenuMove`를 부른다.
    목록 화면이 상세로 갈 때 쓰는 함수다(개찰결과분류조회 → 개찰결과). searchInfo는 돌아올 때 쓸 검색 조건.
- 메뉴 목록 `_gcm.Global.getMenuDataList()`(498개), 찾기 `comUtil.gfnGetMenuInfo(scrnNo·menuNo·menuCangVal·이름)`.
- `gfnOpenMenuMove` 안에 menuCangSeCd 메020006이면 새 창, 2차 인증 메뉴면 인증 확인 분기가 있다.

### 9. 로그인 업무 화면과의 차이 — 모름
- 로그인하지 않았다. 회사 PC에서 같은 스크립트를 한 번 더 돌린다.
- 이미 보이는 차이 후보: 숨은 "나의공고" 탭·그리드 3개, 2차 인증 분기, 업무 화면의 프레임 구성.

기타: 목록 화면은 iframe 1개, 상세 화면은 1~3개(업로드 도구·진행 표시용). 어느 것에도 WebSquare는 없다.

## 상세 화면 (2026-10-28 추가)

목록의 링크 셀을 실제 마우스로 눌러 확인했다(내장 브라우저 1회 + 스크립트 2차 6회·3차 4회).
**6가지 모두 같은 창 전환이다.** 새 탭 0, 팝업 0.

- 연계기관 상세는 2차 6회 숫자다(6회 같음). 3차 1·2회째는 첫 행이 나라장터 공고라 통합 상세만 열렸다.
  연계 행을 따로 고르게 고친 3·4회째는 첫 쪽(10행)에 연계기관 공고가 없었다(스크립트 출력 `no matching row`).
  쪽 넘김은 자동 순회 결정 전이라 하지 않았다.
- 스크립트는 첫 행과 별도로 "연계 URL 있는 첫 행"·"연계 URL 빈 첫 행"을 따로 고른다. 첫 행 종류는 그날 목록에 따라 바뀐다.

### 전환과 돌아오기

| 목록 → 누른 칸 | 상세 화면 | scrnNo | menuNo | menuCangVal | menuLvl |
|---|---|---|---|---|---|
| 발주계획 → 사업명(첫 행) | 발주계획상세조회 | 06750 | 01033 | PRPA015_01 | 2 |
| 사전규격공개 → 사업명(첫 행) | 사전규격상세조회 | 05929 | 01141 | PRVA004_02 | 2 |
| 입찰공고목록 → 공고명(연계 URL 있는 첫 행) | 입찰공고상세조회(연계기관) | 06349 | 01195 | PNPE028_01 | 3 |
| 입찰공고목록 → 공고명(연계 URL 빈 첫 행) | 입찰공고상세조회(통합) | 06085 | 01196 | PNPE027_01 | 3 |
| 개찰결과분류조회 → 진행상태 "개찰완료" | 개찰결과 | 02128 | 01523 | PBOC007_01 | 3 |
| 개찰결과분류조회 → 진행상태 "유찰" | 개찰결과 | 02128 | 01523 | PBOC007_01 | 3 |

- 화면 경로: 발주계획상세 `/ui/pr/prp/prpa/OderPlanV.xml`, 사전규격상세 `/ui/pr/prv/prva/BfSpecAllV.xml`,
  연계기관 상세 `/ui/pn/pnp/pnpe/view/LinkInstBidAnncMngV.xml`, 통합 상세 `/ui/pn/pnp/pnpe/MainBidPbancM.xml`,
  개찰결과 `/ui/pb/pbo/pboc/OnbsRsltAllUsrV.xml`.
- 입찰공고목록의 행은 둘로 나뉜다. 연계기관 공고(행의 `linkInstPbancLnkUrl`이 있음)는 연계기관 상세,
  나라장터 공고는 통합 상세로 간다. 같은 목록에서 상세 화면 코드가 행마다 다르다.
- 유찰·개찰완료는 같은 개찰결과 화면이다. 보이는 그리드만 다르다(아래).
- 돌아오기: 브라우저 뒤로가기(`history.back()`)로 6가지 모두 목록으로 돌아왔다.
  목록을 다시 열어 저장된 검색 조건으로 재조회한다(요청 2~4). 사전규격공개는 검색유형 0002가 복원된다.
  발주계획·사전규격 상세 안에는 "목록" 버튼도 있다(내장 브라우저에서 봄, 누르지 않음).

### history.state.data 변화 (6번 요청)
- 상세로 가면 scrnNo·menuNo·menuCangVal·menuNm·scrnSrcePathNm이 모두 상세 것으로 바뀌고, **`param` 키가 더해진다.**
- `param`에 누른 행의 업무 인자가 실린다(키 이름만 기록, 값은 기록 안 함):
  - 발주계획상세: `oderPlanNo`·`prcmBsneSeCd`. 사전규격상세: `bfSpecRegNo`·`prcmBsneSeCd`.
  - 입찰공고상세(두 종류): 누른 행 전체(47~49키, `bidPbancUntyNo`·`bidPbancUntyOrd` 등).
  - 개찰결과: `pbancInfo`(누른 행 전체).
- 뒤로가면 목록의 state(scrnNo·menuNo·menuCangVal)로 되돌아오고 `param`은 없어진다(6건 모두).
- URL은 상세에서도 `/` 그대로.

### 상세 화면 구조

| 상세 화면 | 그리드 보임/전체 | 그리드 헤더 라벨 | ref 컴포넌트 | 보임 | label[for] | 앞 칸 th | title | 라벨(아무 방식) |
|---|---|---|---|---|---|---|---|---|
| 발주계획상세조회 | 1/1 (첨부파일만) | 7/9 | 63 | 22~23 | 0 | 62 | 60 | 62/63 (98%) |
| 사전규격상세조회 | 2~3/4 | 23/25 | 22 | 13~15 | 0 | 21 | 18 | 21/22 (95%) |
| 입찰공고상세조회(연계기관) | 1/1 (첨부파일만) | 7/9 | 36 | 28 | 0 | 35 | 34 | 35/36 (97%) |
| 입찰공고상세조회(통합) | 4~6/13 | 84/90 | 91 | 35~44 | 0 | 84 | 76 | 84/91 (92%) |
| 개찰결과(개찰완료) | 1/9 | 88/92 | 57 | 10 | 0 | 50 | 50 | 56/57 (98%) |
| 개찰결과(유찰) | 0/9 | 88/92 | 57 | 2 | 0 | 50 | 50 | 56/57 (98%) |

- ref 컴포넌트: 본문 안에서 그리드 밖에 있고 ref가 있는 것(읽기 전용 input·textbox·span 포함).
- 보임 칸만 누른 행에 따라 달랐다(10회 범위). 전체·라벨 칸은 10회 모두 같았다.
- 사전규격상세 그리드 4개: `gvDmndItem`(6/6), `gvCtrtDmndDmstPic`(5/5), `gridOpnnList`(5/5), 첨부파일(7/9).
  보인 조합은 `gvDmndItem`+첨부, `gvDmndItem`+`gridOpnnList`+첨부, `gridOpnnList`+첨부 세 가지.
- 상세 표는 `th|td|th|td` 배치라 "같은 행에 th 있음"은 늘 참이다. 그래서 "바로 앞 칸이 th"를 셌다.
  상세 화면 라벨은 `label[for]`가 아니라 **앞 칸 th**가 기본이다.
- 첨부파일 그리드는 모든 상세에 공통(`wq_uuid_N_grdFile`, dataList `dlUntyAtchFileL`, 헤더 라벨 7/9)이다.
  id가 본문 접두어로 시작하지 않으므로 본문 판정은 DOM 포함 관계여야 한다.

### 5. 그리드가 없는 상세 폼 화면
첨부파일 표 말고는 업무 그리드가 없는 상세가 둘이다. 폼만으로 K-V-L을 뽑아야 한다.
- 발주계획상세조회: ref 컴포넌트 63개(처음 보임 22~23), 라벨 62/63(앞 칸 th 62, title 60, label[for] 0).
- 입찰공고상세조회(연계기관): ref 컴포넌트 36개(처음 보임 28), 라벨 35/36(앞 칸 th 35, title 34, label[for] 0).

### 입찰공고상세조회(통합)의 하위 그리드 (3번 요청)
하위 표는 모두 그리드다. 상세 본문 안의 `mainWframe`(wframe) 아래에 있다.
id 앞부분 `mf_wfm_container_mainWframe_`는 생략. "가까운 소제목"은 내장 브라우저에서 그리드 앞 제목을 읽은 것(추정).

보임 칸은 누른 공고별 묶음이다. A: 2차 6회와 3차 1회째, B: 3차 2회째, C: 3차 3·4회째(각각 다른 첫 행).

| 그리드 id | dataList | 가까운 소제목(추정) | 보임 | 헤더 라벨 |
|---|---|---|---|---|
| grdLcnsLmt | dmLcnsLmtPrmsIntpList | 입찰자격 | B | 3/3 |
| grdCbiShrt | dmItemLmtList3 | 입찰자격 | - | 5/8 |
| gridList1 | dmItemList1 | 입찰진행정보 | A·B·C | 6/6 |
| grdPrpsDmndInfoView | dlPrpsDmndInfoL | 제안발표순서 | C | 3/3 |
| gridView4 | dmItemUsefAmtList | 가용금액공개 | - | 3/3 |
| gridView5 | dmItemBaseAmtList | 기초금액공개 | A·B | 5/5 |
| grdEtspUntyGrp | dmEtpsGrpList | 지명업체 | - | 4/4 |
| gridDmstPic | dmItemList2 | 기관담당자정보 | A·B·C | 6/6 |
| gridDmstPicEvl | dmItemList2 | 기관담당자정보 | - | 6/7 |
| gridView3 | dmItemItemList | 구매대상물품 | A·B | 14/14 |
| gridView6 | dmItrlItemItemList | 구매대상물품 | - | 16/16 |
| gridViewPgst | dlBidBasePgstL | (확인 못 함) | - | 6/6 |
| (본문 직속) wq_uuid_N_grdFile | dlUntyAtchFileL | 첨부파일 | A·B·C | 7/9 |

- 13개 중 보임 A 5개, B 6개, C 4개. 어떤 그리드가 보이는지는 공고 종류(물품·용역·공사 등)에 따라 달라진다.
  늘 보인 것은 `gridList1`·`gridDmstPic`·첨부파일 셋. 수집은 13개 전부를 사전에 두고 보이는 것만 읽어야 한다.
- 자격제한·면허는 `grdLcnsLmt`·`grdCbiShrt`, 물품은 `gridView3`·`gridView6`, 수요기관 담당자는 `gridDmstPic`.

### 개찰결과 화면 (4번 요청)
- 목록 개찰결과분류조회(02117, 01522)의 진행상태 칸(`bidPgstCd`)이 링크다.
  공개 목록에서 본 값은 "개찰완료"와 "유찰" 두 가지였다.
- 클릭 처리 함수는 둘 다 `com.gfnOpenMenu("PBOC007_01", {isHistory, param}, searchInfo)` → 개찰결과(02128).
- 개찰결과 그리드 9개: `onbsRsltRbidGrd`(17열, 라벨 14), `grdGods`(11/11), `grdSrvc`(10/10), `grdFrcp`(10/11),
  `grdCstn`(12/12), `grdExcelDown`(7/7), `grdLase`(7/7), `grdRsrv`(12/12), `gridGangwon`(5/5, 행 읽기 실패).
- 업무 구분별 그리드(물품·용역·외자·공사·리스·비축 추정)를 하나만 보인다. 이번 개찰완료 공고는 `grdCstn` 1개가 보였다.
  유찰은 9개 모두 숨김(보이는 ref 컴포넌트 2개).
- `gridGangwon`은 `options.dataList`에 이름(`dlEtpsItemBdngAmtL`)은 있지만 `getAllJSON()`이 실패한다(10회 모두).
  dataList 객체가 실제로 묶이지 않은 것으로 보인다. 수집 코드는 이 경우를 건너뛰어야 한다.

## PLAN.md 선행 실측과 다른 점

- 탭: 선행 표의 "탭 2개, 전환 요청 0건"은 실제로는 숨은 "나의공고" 탭으로의 전환이 **무시된 것**이다.
  "숨은 탭의 그리드를 안 누르고 읽음"은 다른 탭이 아니라 같은 탭 안 숨은 복제 그리드(`gridView4`, 같은 dataList)다.
- 행 높이: 선행 표의 "40px 그대로"는 선택자 문제였다. `.w2grid .gridBodyDefault{height}`로 바뀌고,
  두 줄 셀이 있는 그리드만 내용 높이가 하한이다.
- 글꼴: `body *`에 `!important`로 주면 깊은 요소까지 바뀐다.
- ref 빈 컴포넌트: 선행 표 1,989개 중 1,841개 → 이번 2,011개 중 1,813개. 같은 경향.
- 직링크: 선행 표는 메뉴 trigger만 확인했다. `com.gfnOpenMenuMove`·`com.gfnOpenMenu` 둘 다 쓸 수 있다.

## 2단계로 미룰 것 후보 ("안 됨" 없음)

"안 됨" 항목은 목록·상세 모두 없다. 조건부 항목은
1(사전규격 구분에 검색유형 필요), 5(자동 순회 결정 대기), 6(공개 화면에서 탭 전환 미확인), 7(두 줄 셀 행 높이).
9는 회사 PC 시험 전까지 모름.
