# AG Grid Community 36: 뷰어 2단계 후보 기능별 되는 것·안 되는 것

대상: 설치본 `node_modules/ag-grid-community` **36.2.0**(그 package.json의 version). 루트 package.json은 `^36.2.0`이고
`ag-grid-enterprise`는 설치돼 있지 않다. 웹 검색은 쓰지 않았고 설치본과 저장소 안에서만 근거를 찾았다.

## 0. 읽는 법과 한계
| 표기 | 뜻 |
|---|---|
| `M:줄` | node_modules/ag-grid-community/dist/package/main.esm.mjs의 줄 |
| `R:줄` | 같은 폴더 README.md의 줄 |
| `G:줄` | viewer/grid-adapter.ts의 줄 |
| `T` | 선언 파일. shared-css·theme는 ag-stack, core-css는 ag-grid-community 안 `dist/types/src/theming` |
| 실측 | happy-dom에서 `createGrid`를 만들고 ValidationModule의 메시지를 읽은 것. 아래 한계 참고 |

- 근거 3층: ① README 기능표(R:94-124) ② 설치본이 스스로 가진 Enterprise 모듈 이름표(M:60886-60928)
  ③ 실측. 설치본은 Enterprise 옵션을 쓰면 `error #200 Unable to use X as YModule is not registered`를 낸다.
- **실측은 실제 Chrome 화면이 아니다.** 모듈이 없다·행 모델이 안 맞다는 메시지까지만 확인했고, 키 입력·그리기·복사
  같은 화면 동작은 확인하지 못했다. 그런 것은 "미확인"(U번호)으로 두고 10절에 모았다.
- 실측 스크립트는 scratchpad의 임시 파일이고 저장소에는 넣지 않았다. 다시 돌릴 필요가 있으면 scripts/ probe로 둘지 결정한다.

## 1. 지금 뷰어
| 항목 | 현재 |
|---|---|
| 등록 모듈 | `ColumnApiModule`, `InfiniteRowModelModule`, `TextFilterModule` (G:20) |
| 행 모델 | `rowModelType: 'infinite'`, `cacheBlockSize` 500, `rowBuffer` 3 (G:124-126) |
| 열 | `editable: false`, 텍스트 필터+떠 있는 필터, `valueFormatter`(G:92-96) |
| 테마·밀도 | `themeQuartz` 기본, `rowHeight` 옵션 32 (G:122-123) |
| 열 상태 | `getColumnState`/`applyColumnState`로 폭·순서·숨김만 저장(viewer/column-state.ts:2, G:142-152) |

## 2. 모듈 구조에서 알아야 할 것
| 사실 | 근거 |
|---|---|
| 코어가 열 이동·크기·정렬·열 그룹·키보드 탐색·열 고정·Aria·함수형 렌더러를 끌고 온다: **추가 등록 없이** 됨 | M:37293-37306 |
| `AllCommunityModule`은 편집기·행 선택·고정 행·페이지·CSV·툴팁·스타일 등 Community 전부를 묶는다 | M:60809-60865 |
| Enterprise 이름표(`ENTERPRISE_MODULE_NAMES`)에 든 것은 `ag-grid-enterprise`에서 가져와야 한다 | M:60886-60928 |
| 번들 크기는 개별 등록이 작을 것으로 보이나 `AllCommunityModule`과 비교 측정은 하지 않았다(U12) | - |

## 3. 셀 편집 (기본 에디터·select·date·Enter/Tab 이동·붙여넣기·undo)
| 항목 | 판정 | 근거 |
|---|---|---|
| 기본 글자 편집기 | Community | `TextEditorModule`(M:47173-47250). 실측: 모듈 없이 `editable:true`면 #200 |
| select 편집기 `agSelectCellEditor` | Community | `SelectEditorModule`(M:26390). 실측 #200 확인 |
| 날짜 편집기 `agDateStringCellEditor` | Community | `DateEditorModule`(M:26394). 값 형식 맞춤은 U1 |
| 숫자·체크박스·긴 글 편집기 | Community | `NumberEditorModule`·`CheckboxEditorModule`·`LargeTextEditorModule`(M:26392-26396) |
| 목록 상자형 `agRichSelectCellEditor` | **Enterprise** | `RichSelect`(M:60911). 실측: ag-grid-enterprise에서 가져오라는 #200 |
| Enter·Tab·F2·Esc·화살표 이동 | Community(코어) | 키보드 탐색이 코어(M:37302), F2 처리(M:11550, M:29988). 키별 동작은 U4 |
| 이동 방식 조절 | Community | `enterNavigatesVerticallyAfterEdit`·`tabToNextCell`(M:257, M:27221). 실측 에러 없음 |
| 셀 붙여넣기(Ctrl+V) | **Enterprise** | `Clipboard`(M:60893). `onCtrlAndV`는 클립보드 서비스가 있을 때만 붙여넣는다(M:11665-11672) |
| 편집 칸 안 붙여넣기 | 브라우저 기본 | 편집 중이면 격자가 손대지 않고 돌아간다(M:11667-11669). 화면 동작은 U4 |
| undo·redo (Ctrl+Z) | Community | `UndoRedoEditModule`(M:47194), 옵션 `undoRedoCellEditing`(M:259). 실측 #200 |
| 값을 격자가 쓰지 않고 요청만 | Community | `readOnlyEdit`(M:254)이면 값을 쓰는 대신 `cellEditRequest`를 낸다(M:4189-4197) |
- Community 대체: 별도 대체 없이 기본 편집기만 쓴다(AGENTS "자체 그리드 편집기 금지").
- 코어에 쓰는 길: `readOnlyEdit`+`cellEditRequest` → 코어 PATCH → 다시 받기. infinite에서의 실제 흐름은 U2, undo와 비동기 쓰기의 결합은 U3.
- 추가 등록 모듈: `TextEditorModule`(필수), `SelectEditorModule`, `DateEditorModule`, `NumberEditorModule`,
  `UndoRedoEditModule`.
- 지금은 `editable:false`(G:92)라 에러가 없다. `editable:true`를 주는 순간 `TextEditorModule`이 없으면 #200이 난다(실측).
- SPEC 9절이 "뷰어 편집"을 하지 않는 것으로 두었으니, 편집을 넣으려면 SPEC·DECISIONS를 먼저 고친다.

## 4. 행 추가·삭제
| 항목 | 판정 | 근거 |
|---|---|---|
| `applyTransaction`(행 넣고 빼기) | **안 됨(infinite)** | clientSide만(M:62387). 실측 `error #311` |
| `applyServerSideTransaction` | Enterprise | serverSide만(M:62393), `ServerSideRowModel`(M:60917) |
| 다시 받기 `refreshInfiniteCache`·`purgeInfiniteCache` | Community, 이미 등록 | `InfiniteRowModelModule`의 API(M:55030-55038) |
| 행 개수 직접 지정 `setRowCount` | Community | infinite·serverSide 공통 API(M:62407) |
| 위·아래 고정 행(새 행 입력줄 자리) | Community | `pinnedTopRowData`·`pinnedBottomRowData` → `PinnedRowModule`(M:27500, M:57706) |
| `enableRowPinning`(행을 고정하는 UI) | 안 됨(infinite) | 실측 `warning #309`: clientSide만 |
| 삭제할 행 고르기 | Community | `RowSelectionModule`이 infinite를 지원(M:60670). 머리 체크박스(전체 선택)는 infinite 불가(실측 #129) |
- Community 대체: 코어에 POST·DELETE 요청(지금 DELETE는 없다, S63) 뒤 `api.refreshInfiniteCache()`로 새로 받기.
- 추가 등록 모듈: 없음(다시 받기는 등록돼 있음). 고정 행이면 `PinnedRowModule`, 행 선택이면 `RowSelectionModule`.

## 5. 열 고정(pinned)·열 그룹
| 항목 | 판정 | 근거 |
|---|---|---|
| `colDef.pinned: 'left'\|'right'`, `setColumnsPinned` | Community(코어) | `PinnedColumn`이 코어(M:37303). 실측 에러 없음 |
| 열 그룹 `children`(열 묶음 머리) | Community(코어) | `ColumnGroup`이 코어(M:37297). 실측 에러 없음 |
| 열 상태 저장에 pinned 넣기 | 가능해 보임 | `getColumnState`는 pinned를 갖는다. 지금 `SavedColumn`은 colId·width·hide뿐(column-state.ts:2) |
| 열 그룹 펼침 상태 저장 | 미확인 | U5 |
- 추가 등록 모듈: 없음. 저장 필드를 늘리면 viewer 폴더 안(column-state.ts) 수정이다.

## 6. 다크 테마·밀도
| 항목 | 판정 | 근거 |
|---|---|---|
| `themeQuartz.withPart(colorSchemeDark)` | Community | 둘 다 export(M:24157, M:24694). 실측 에러 없음 |
| `.withParams({...})` | Community | T ag-stack/theming/theme.d.ts:22: `withParams(defaults, mode?)` |
| 밀도 파라미터 | Community | `spacing`·`fontSize`·`headerHeight`(T shared-css:209, 85, 113), `rowHeight`(T core-css:376) |
| 밝음·어두움 자동 전환 | 가능해 보임 | `colorSchemeVariable` export와 `data-ag-theme-mode` 속성 규칙(ag-stack main.esm.mjs:3647). 동작은 U6 |
| `rowHeight` 옵션과 테마 파라미터 겹침 | 미확인 | 실측: 둘을 같이 줘도 에러는 없다. 어느 쪽이 이기는지는 U7 |
- 추가 등록 모듈: 없음(테마는 `createGrid`의 `theme` 옵션이고 모듈이 아니다).
- 뷰어 안의 툴바·상태줄 CSS는 격자 테마와 따로라 같이 어두워지게 해야 한다(viewer.html에 다크 스타일은 아직 없다).

## 7. 클립보드(Ctrl+C 범위 복사)·범위 선택
| 항목 | 판정 | 근거 |
|---|---|---|
| Ctrl+C 범위 복사 | **Enterprise** | README `Clipboard Operations ❌`(R:118), `Clipboard`(M:60893). 서비스 없으면 중단(M:11643) |
| `api.copyToClipboard()` 등 | **Enterprise** | 실측: `ClipboardModule` 미등록 #200(ag-grid-enterprise) |
| 셀 범위 선택 | **Enterprise** | README `Range Selection ❌`(R:113). `CellSelection`(M:60892). 실측 `cellSelection` #200 |
| 행 선택(체크박스·Shift) | Community | `RowSelectionModule`, infinite 지원(M:60670). README `Selection ✅`(R:103) |
| CSV 내보내기 | Community | `CsvExportModule`(R:100). Excel 내보내기는 Enterprise(R:116, M:60898) |
- Community 대체 ①: `enableCellTextSelection: true`. 켜면 격자가 Ctrl+C를 가로채지 않는다(M:11644-11645).
  브라우저의 글자 선택·복사에 맡기는 길이고 실제로 복사되는지는 U8.
- Community 대체 ②: 선택한 행의 값을 `getCellValue`로 모아 `navigator.clipboard`에 쓰는 우리 코드. 편집기는 아니지만 자체 코드라 결정이 필요하다.
- 추가 등록 모듈: 없음(Enterprise 도입 안 함이 기본). 행 선택이면 `RowSelectionModule`.

## 8. 나머지 후보
### 8.1 컨텍스트 메뉴
| 항목 | 판정 | 근거 |
|---|---|---|
| 우클릭 메뉴(`getContextMenuItems`) | **Enterprise** | README `Context Menu ❌`(R:122), `ContextMenu`(M:60897). 실측 #200 |
| 열 메뉴 | **Enterprise** | README `Column Menu ❌`(R:121), `ColumnMenu`(M:60895) |
| 우클릭 이벤트 | Community | `cellContextMenu`(M:26170), `onCellContextMenu`(M:31036), `preventDefaultOnContextMenu`(M:217) |
- 대체: 이벤트만 받아 우리 DOM 메뉴를 그리는 길. 자체 UI 코드가 되니 결정 사항. docs/grid-choice.md도 "메뉴 없음"으로 적었다.
- 추가 등록 모듈: 없음. 지금 열 숨김은 viewer/column-picker.ts가 한다.

### 8.2 상태바·집계
| 항목 | 판정 | 근거 |
|---|---|---|
| 상태바 `statusBar` | **Enterprise** | `StatusBar`(M:60922). 실측 #200 |
| 합계·평균 `aggFunc` | **Enterprise** | `RowGrouping`·`Pivot`·`TreeData` 중 하나가 필요(M:60973). 실측 #200 |
| 행 그룹·피벗·트리 | **Enterprise** | `RowGrouping`(M:60913)·`Pivot`(M:60909) |
- 대체: 행 수는 이미 툴바 "N행"(viewer/main.ts:33)이 한다. 합계는 코어가 계산해 `pinnedBottomRowData`로 보이는 길.
  옵션 검증은 통과했지만 infinite에서 도는지는 U9.
- 추가 등록 모듈: 합계 줄을 쓰면 `PinnedRowModule`. 선택 수는 `RowSelectionModule`.

### 8.3 서버측 행 모델: infinite와 serverSide
| 항목 | infinite | serverSide |
|---|---|---|
| 소속 | Community, 이미 등록(G:20, G:124) | **Enterprise** `ServerSideRowModel`(M:60917). 실측 #200 |
| README | `Infinite Scrolling ✅`(R:105) | `Server-Side Data ✅ / ✅(Advanced)`(R:107): Community의 서버측 공급이 infinite |
| 정렬·필터 | 격자는 모델만 넘기고 코어가 처리(지금 방식) | 같음 |
| 안 되는 것 | 빠른 필터(#309), 행 고정(#309), 머리 전체선택(#129), 트랜잭션(#311) | 그룹·피벗·트리·서버 트랜잭션은 여기서만 |
- 지금 SPEC에는 serverSide가 필요한 기능(그룹·피벗·서버 트랜잭션)이 없다. 추가 등록 모듈: 없음(현상 유지).

### 8.4 열 상태 저장(이미 쓰는 것)
| 항목 | 판정 | 근거 |
|---|---|---|
| `getColumnState`/`applyColumnState` | Community, 이미 등록 | `ColumnApiModule`(M:22694), 사용처 G:142-152 |
| 격자 상태 한 덩어리 `getState`/`initialState` | Community | `GridStateModule`(M:56319). 실측: infinite에서 경고 없음 |
- SPEC 7절은 정렬·필터를 저장하지 않는다(S161). `GridStateModule`은 필요해질 때만 추가한다.

### 8.5 셀 렌더러·포매터·툴팁
| 항목 | 판정 | 근거 |
|---|---|---|
| `valueFormatter` | Community(코어), 이미 씀 | G:96 |
| 함수형 `cellRenderer` | Community(코어) | `CellRendererFunction`이 코어(M:37306). 실측 에러 없음 |
| 사용자 정의 렌더러 컴포넌트 | Community | README `Custom Components ✅`(R:108) |
| 내장 `agCheckboxCellRenderer` | 미확인 | 설치본 해석표가 `AllCommunity`로 보낸다(M:60952). 개별 모듈 이름은 U10 |
| `cellStyle`·`cellClass` | Community | `CellStyleModule`(M:60796). 실측 #200 |
| 툴팁 | Community | `TooltipModule`(M:40807). `tooltipField`는 36.2에서 deprecated(실측 #306), `tooltip` 콜백을 쓴다 |
- 추가 등록 모듈: `CellStyleModule`, `TooltipModule`(쓸 때만).

### 8.6 키보드 탐색·단축키·접근성
| 항목 | 판정 | 근거 |
|---|---|---|
| 화살표·Tab·Enter·F2·Esc 이동 | Community(코어) | 키보드 탐색이 코어(M:37302). 키별 동작은 U4 |
| Ctrl+C/X/V/D | **Enterprise** | 클립보드 서비스를 전제(M:11643-11681) |
| Ctrl+Z | Community | `UndoRedoEditModule` 있을 때(M:11680) |
| 단축키 가로채기·바꾸기 | Community | `suppressKeyboardEvent`·`tabToNextCell`·`navigateToNextCell`. 실측 에러 없음 |
| 접근성 | Community | README `Accessibility ✅`(R:104). `Aria`가 코어(M:37304) |
- 읽기 전용 infinite 목록에서 스크린리더가 어떻게 읽는지는 U11. 추가 등록 모듈: 없음(undo만 `UndoRedoEditModule`).

## 9. 등록할 모듈 요약
| 구분 | 모듈 | 쓰는 기능 |
|---|---|---|
| Community 추가 | `TextEditorModule`, `SelectEditorModule`, `DateEditorModule`, `NumberEditorModule` | 편집(3절) |
| | `UndoRedoEditModule` | undo(3절) |
| | `RowSelectionModule` | 행 선택·삭제할 행 고르기(4·7절) |
| | `PinnedRowModule` | 고정 행·합계 줄(4·8.2절) |
| | `CellStyleModule`, `TooltipModule`, `GridStateModule` | 8.4·8.5절 |
| Enterprise(기본은 도입 안 함) | `CellSelectionModule`, `ClipboardModule`, `ContextMenuModule`, `ColumnMenuModule` | 7·8.1절 |
| | `StatusBarModule`, `RowGroupingModule`, `ServerSideRowModelModule`, `RichSelectModule` | 3·8.2·8.3절 |
- Enterprise 모듈 이름은 실측 #200 메시지가 안내한 `import ... from 'ag-grid-enterprise'`를 따랐다.

## 10. 미확인 항목 (11개)
| 번호 | 내용 |
|---|---|
| U1 | 날짜 편집기가 SPEC의 날짜 글자(숫자만 남긴 글자)와 맞는지. 변환(valueParser)이 필요한지 |
| U2 | `readOnlyEdit`+`cellEditRequest`로 코어에 쓰고 다시 받는 흐름이 실제 화면에서 도는지 |
| U3 | undo가 값을 되돌릴 때 비동기 코어 쓰기와 어떻게 맞물리는지 |
| U4 | 편집 칸 안 Ctrl+V가 브라우저 기본대로 되는지, Tab·Enter·F2·Esc 이동이 실제 화면에서 설명대로인지 |
| U5 | 열 그룹 펼침 상태와 pinned를 저장·복원할 때 문제가 없는지 |
| U6 | `colorSchemeVariable`과 `data-ag-theme-mode`로 밝음·어두움이 실제로 전환되는지 |
| U7 | 테마 `rowHeight` 파라미터와 `rowHeight` 옵션 중 무엇이 이기는지 |
| U8 | `enableCellTextSelection`으로 셀 글자 복사가 실제로 되는지 |
| U9 | `pinnedBottomRowData`가 infinite 행 모델과 함께 정상으로 그려지는지 |
| U10 | `agCheckboxCellRenderer`를 쓰려면 정확히 어떤 모듈을 등록하나 |
| U11 | 스크린리더가 가상화된 infinite 목록을 어떻게 읽는지 |
- U12(번들 크기: 개별 등록 대 `AllCommunityModule`)는 측정하지 않았다. 위 표의 "(11개)"에는 넣지 않았다.
