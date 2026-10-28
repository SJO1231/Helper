# S3 extension — 추출·스냅샷·수집·리모컨 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** MV3 확장이 공개 나라장터 화면을 SPEC 7절 규칙으로 읽어 스냅샷을 보여 주고, 수집을 코어에 보내며,
화면을 자동 등록하고, 리모컨(−1년/+1년·조회건수)과 진단 줄을 띄운다.

**Architecture:** 페이지 안 읽기는 `chrome.scripting.executeScript({world: 'MAIN'})`로 넣는 순수 함수(`sites/g2b/`).
WebSquare 객체는 인자로 받은 `Window`에서만 꺼내 시험에서 가짜 창을 넣는다. 코어 호출은 `shared/core-client.ts`만,
토큰은 `carryover/extension/host.ts`(그대로)로 Native `hello`를 보내 받는다. 리모컨은 Shadow DOM 오버레이.

**Tech Stack:** TypeScript, esbuild(`carryover/scripts/build-mvp.mjs`를 옮김), vitest + happy-dom, @types/chrome.

**Spec:** `docs/SPEC.md` 3·4.1·4.4·7절. 공통 규칙은 `2026-10-28-stage1-00-index.md`.

## Global Constraints
index 파일 그대로. 이 세션은 `extension/`(단 `common/dictionary.ts`는 S5 것, 읽기만), `scripts/build.mjs`,
`scripts/install-host.ps1`, `scripts/extension-key.json`, `package.json`의 scripts·devDependencies만 고친다.
시험 fixture는 가짜 WebSquare 구조만(`carryover/extension/extraction.test.ts`의 mockWebSquare 패턴), 값은 자리표시.

---

### Task 1: 빌드와 설치

**Files:**
- Create: `scripts/build.mjs`, `scripts/manifest.mjs`, `scripts/install-host.ps1`
- Copy: `carryover/scripts/mvp-extension-key.json` → `scripts/extension-key.json`
- Modify: `package.json` (`verify`에 `&& node scripts/build.mjs`, devDependencies `esbuild`·`@types/chrome`·`happy-dom`)
- Test: `scripts/manifest.test.ts`

**Interfaces:**
- Produces: `buildManifest(opts: { key: string; hasViewer: boolean }): chrome.runtime.ManifestV3`.
  빌드 결과 `dist/extension/`: `background.js`, `page.js`(MAIN world 함수 묶음), `remote.js`, `viewer.html`·`viewer.js`
  (`viewer/viewer.html`이 있을 때만). Native host 이름 `com.helper.core`, 실행은 `python -m core.native_main`.
- `install-host.ps1`은 HKCU의 `Google\Chrome\NativeMessagingHosts`와 `Chromium\NativeMessagingHosts` 둘 다에 등록한다
  (설치 대상 Chrome, 시험 Playwright Chromium).

- [ ] **Step 1: Write the failing test**

```ts
test('manifest asks only for g2b and loopback hosts', () => {
  expect(m.host_permissions).toEqual(['https://www.g2b.go.kr/*', 'http://127.0.0.1/*']);
});
test('manifest permissions are nativeMessaging, scripting, storage only', () =>
  expect([...m.permissions!].sort()).toEqual(['nativeMessaging', 'scripting', 'storage']));
test('manifest carries the fixed key', () => expect(m.key).toBe(key));
test('viewer page appears only when built', () =>
  expect(buildManifest({ key, hasViewer: false }).web_accessible_resources).toBeUndefined());
```

- [ ] **Step 2: Run** `npx vitest run scripts/manifest.test.ts` → FAIL
- [ ] **Step 3: 구현.** `build-mvp.mjs`의 esbuild 설정·key 검증을 옮기고 진입점만 바꾼다.
- [ ] **Step 4: Run** `npm run verify` → PASS, `dist/extension/manifest.json` 생김
- [ ] **Step 5: Commit** `git commit -m "S3: 확장 빌드와 Native host 설치"`

---

### Task 2: 폼·그리드·param 읽기

**Files:**
- Create: `extension/sites/g2b/body.ts`, `extension/sites/g2b/form.ts`, `extension/sites/g2b/grids.ts`,
  `extension/sites/g2b/param.ts`, `extension/sites/g2b/test-fixtures.ts`
- Test: `extension/sites/g2b/read.test.ts`

**Interfaces:**
- Produces:
  - `inBody(el: Element, doc: Document): boolean` — `#mf_wfm_container`의 DOM 자손인가(id 접두어 아님)
  - `isVisible(el: Element): boolean` — `getClientRects().length > 0`
  - `readForm(win: Window, filter: (el: Element) => boolean): { fields: PointField[]; droppedEmptyRef: number }`
  - `findLabel(el: Element): string` — `label[for]` → 바로 앞 칸 `th` → 같은 행 `th` → `title`, 없으면 `''`
  - `readGrids(win: Window, filter): { tables: RawTable[]; droppedSameDataList: number; failedGrids: number }`
  - `flattenParam(param: unknown): { param: Record<string, string>; dropped: number }`

- [ ] **Step 1: Write the failing test** (`test-fixtures.ts`의 `makeWindow({ forms, grids, outside })`로 가짜 창)

```ts
test('form K strips data: prefix and keeps dataMap', () => expect(f.k).toBe('dmA.keyA'));
test('form V uses getValue, not input.value', () => expect(f.v).toBe('RAW'));  // input.value는 'FORMATTED'
test('label order: label[for] > previous th > row th > title', ...)  // 네 경우 각각
test('empty ref components are dropped and counted', () => expect(r.droppedEmptyRef).toBe(2));
test('element with wq_uuid id inside container counts as body', () => expect(inBody(attach, doc)).toBe(true));
test('grids sharing a dataList keep the visible one', () => {
  expect(t.tables.map(x => x.id)).toEqual(['gridVisible']); expect(t.droppedSameDataList).toBe(1);
});
test('both hidden with same dataList keep document-first', ...)
test('grid whose getAllJSON throws is skipped and counted', () => expect(t.failedGrids).toBe(1));
test('grid labels come from getHeaderID then getHeaderValue', () => expect(t.tables[0].columns[0].l).toBe('L1'));
test('values become text: 0, false, 00 survive', () => expect(row).toEqual({ a: '0', b: 'false', c: '00', d: '' }));
test('param flattens one level and drops deeper', () => {
  expect(p.param).toEqual({ 'param.k1': 'V', 'param.obj.k2': 'V' }); expect(p.dropped).toBe(2);
});
```

- [ ] **Step 2: Run** `npx vitest run extension/sites/g2b/read.test.ts` → FAIL
- [ ] **Step 3: 구현.** `carryover/extension/collect.ts`의 컴포넌트 순회를 바탕으로 쓴다. `getHeaderIDArr()`는 부르지 않는다.
- [ ] **Step 4: Run** `npm run verify` → PASS
- [ ] **Step 5: Commit** `git commit -m "S3: 폼·그리드·param 읽기"`

---

### Task 3: collectScreen — 모드·프레임·로딩·화면 바뀜

**Files:**
- Create: `extension/sites/g2b/identify.ts`, `extension/sites/g2b/frames.ts`, `extension/sites/g2b/loading.ts`,
  `extension/sites/g2b/collect.ts`
- Test: `extension/sites/g2b/collect.test.ts`

**Interfaces:**
- Consumes: Task 2 함수.
- Produces:
  - `readScreenState(win: Window): { menuNo: string; scrnNo: string; menuCangVal: string; menuNm: string;
    state: Record<string,string>; param: unknown } | null` — `history.state.data`, 없으면 null
  - `waitUntilLoaded(win: Window, opts?: { intervalMs?: number; timeoutMs?: number }): Promise<void>`
    — `#__processbarIFrame`이 보이는 동안 200ms마다, 10초 넘으면 `Error('loading')`
  - `framesWithWebSquare(win: Window): Window[]` — `$p`가 있는 프레임, 최상위부터 너비 우선
  - `collectScreen(win: Window, mode: ExtractMode): Promise<{ raw: RawCapture; diag: Diagnostics;
    screen: { menuNo: string; scrnNo: string; menuNm: string } }>`
  - 오류 코드: `'loading'`, `'no-screen'`, `'screen-changed'`

- [ ] **Step 1: Write the failing test**

```ts
test('visible mode reads body and visible only', ...)  // fixture: 보임 2, 숨김 1, 본문 밖 1
test('hidden mode reads whole body', ...)  // 3
test('all mode reads whole document', ...)  // 4
test('empty-ref exclusion applies in all three modes', ...)
test('frames merge; on same K the visible one wins, then the frame nearer the top', ...)
test('waits while process bar is visible and gives up after 10s', async () => {
  vi.useFakeTimers(); const p = waitUntilLoaded(win); vi.advanceTimersByTime(10_000);
  await expect(p).rejects.toThrow('loading');
});
test('menuNo change between start and end rejects with screen-changed', async () => {  // Review Focus 2
  await expect(collectScreen(winThatNavigatesMidway, 'visible')).rejects.toThrow('screen-changed');
});
test('raw carries state without param and param flattened', ...)
```

- [ ] **Step 2: Run** → FAIL · **Step 3: 구현** · **Step 4: Run** `npm run verify` → PASS
- [ ] **Step 5: Commit** `git commit -m "S3: collectScreen"`

---

### Task 4: 리모컨 화면 조작 (기간·조회건수)

**Files:**
- Create: `extension/sites/g2b/remote-actions.ts`
- Test: `extension/sites/g2b/remote-actions.test.ts`

**Interfaces:**
- Produces:
  - `shiftYear(win: Window, delta: -1 | 1): { ok: boolean; year?: number; reason?: string }`
    — 본문에서 보이는 `inputCalendar` 중 같은 표 행의 첫 둘을 시작·끝으로(없으면 문서 순서 이웃 둘).
    시작일의 해 + delta로 `setValue('YYYY0101')`, `setValue('YYYY1231')`. 조회 버튼은 건드리지 않는다.
  - `applyRowCount(win: Window, n: number): { ok: boolean; reason?: string }` — 보이는 그리드 가까운 쪽 크기 select.
    값이 목록에 없으면 `<option>`을 더하고 컴포넌트 `addItem(n, n)` 뒤 `setValue(n)`(v4.2 applyRowCount 방식).
  - `ROW_COUNT_CHOICES = [10, 30, 50, 100, 250, 500, 1000]`

- [ ] **Step 1: Write the failing test**

```ts
test('-1 year sets both to Jan 1 and Dec 31 of start year - 1', () => {
  shiftYear(win, -1); expect(cal(start).getValue()).toBe('20250101'); expect(cal(end).getValue()).toBe('20251231');
});  // fixture 시작일 20260315
test('+1 year uses start year + 1', ...)
test('hidden calendars are skipped', ...)
test('search button is not triggered', () => { shiftYear(win, -1); expect(searchClicks).toBe(0); });
test('no visible pair returns ok false with reason', ...)
test('row count already listed only calls setValue', () => expect(calls).toEqual([['setValue', 100]]));
test('row count 250 adds option, addItem, then setValue', () =>
  expect(calls).toEqual([['addItem', 250, 250], ['setValue', 250]]));
```

- [ ] **Step 2: Run** → FAIL · **Step 3: 구현** · **Step 4: Run** → PASS
- [ ] **Step 5: Commit** `git commit -m "S3: 리모컨 기간·조회건수"`

---

### Task 5: background — 연결·수집·자동 등록

**Files:**
- Create: `extension/common/background.ts`, `extension/common/connection.ts`, `extension/common/screen-watch.ts`
- Copy: `carryover/extension/host.ts` → `extension/common/host.ts`(그대로)
- Test: `extension/common/background.test.ts`

**Interfaces:**
- Consumes: `createCoreClient`, `collectScreen`, `readScreenState`.
- Produces (runtime 메시지, `kind`로 가름):
  - `{kind:'snapshot', mode}` → `{ raw, diag, labels: Record<string,string> }`(라벨은 `resolveLabel` 결과)
  - `{kind:'collect', mode}` → `CaptureResult`
  - `{kind:'screen-info'}` → `DictScreen | null`(수집 버튼 켜기용, `getRecords('dict_screen', {filter})`)
  - `{kind:'core.connection'}` → `ConnectionInfo`(뷰어가 부름)
  - `screen-watch.ts`: MAIN world에서 `history.pushState`·`replaceState`·`popstate`를 보고 menuNo가 바뀌면
    `{kind:'screen.changed', menuNo, scrnNo, menuCangVal, menuNm}`를 보냄 → background가
    `putRecords('dict_screen', [{require: {site: 'g2b', menu_no}, fields: {scrn_no, menu_cang_val, name}}],
    {noupdate: true})`
  - `getConnection(): Promise<ConnectionInfo>`는 토큰을 `chrome.storage.session`에만 둔다.

- [ ] **Step 1: Write the failing test** (가짜 chrome API·가짜 Native·가짜 fetch)

```ts
test('screen change sends PUT dict_screen with noupdate and site+menu_no require', ...)
test('collect posts CaptureFields with chosen mode and site g2b', () =>
  expect(body.records[0].fields.mode).toBe('hidden'));
test('401 triggers one new hello and one retry', () => expect(helloCalls).toBe(2));  // Review Focus 1
test('offline core yields diag core offline, nothing queued', ...)
test('screen change failure is not retried later', ...)
test('core.connection answers only extension pages', ...)  // sender.url이 chrome-extension://<id>/ 아니면 거절
```

- [ ] **Step 2: Run** → FAIL · **Step 3: 구현** · **Step 4: Run** `npm run verify` → PASS
- [ ] **Step 5: Commit** `git commit -m "S3: background 연결·수집·자동 등록"`

---

### Task 6: 리모컨 창·스냅샷 창·진단 줄

**Files:**
- Create: `extension/common/remote.ts`, `extension/common/snapshot-view.ts`, `extension/common/diagnostics.ts`
- Test: `extension/common/remote.test.ts`

**Interfaces:**
- Consumes: Task 5 메시지, Task 4 `ROW_COUNT_CHOICES`.
- Produces: 리모컨 버튼 `수집`, `스냅샷`, 모드 select(`보이는 것만`/`숨김 포함`/`전체`, 기본 보이는 것만), `−1년`, `+1년`,
  조회건수 select + 직접 입력. `formatDiagnostics(d: Diagnostics): string`. 스냅샷 창은 읽기 전용 HTML 표(편집 없음).

- [ ] **Step 1: Write the failing test** (happy-dom)

```ts
test('collect button disabled when screen has no stage', ...)
test('snapshot table headers are resolved labels', () => expect(ths).toEqual(['L-user', 'L-screen', 'L1']));
test('diagnostics line shows empty-ref and unknown-key counts as numbers', () =>
  expect(line).toMatch(/빈 ref 제외 \d+/) && expect(line).toMatch(/미등록 키 \d+/));
test('changed result shows "바뀐 칸 n개" toast without confirm dialog', ...)
test('offline shows "코어 꺼짐"', ...)
test('snapshot sends no write request', () => expect(writes).toBe(0));
```

- [ ] **Step 2: Run** → FAIL · **Step 3: 구현** · **Step 4: Run** `npm run verify` → PASS
- [ ] **Step 5: 공개 화면 실측(AGENTS 검증 규칙).** `pwsh -File scripts/install-host.ps1` 뒤 `dist/extension`을 Chrome에 올리고
  발주목록(13713)·입찰공고목록(01175)·상세 3종에서 스냅샷·수집을 한 번씩. PR 본문에 화면별 폼·그리드·제외·미등록 수만 적는다.
  조회건수 250이 실제로 먹는지 여기서 확인하고 결과를 DECISIONS에 한 줄.
- [ ] **Step 6: Commit** `git commit -m "S3: 리모컨·스냅샷·진단 줄"`

## 끝 기준 (이 세션)
- `npm run verify`가 오류 0(빌드 포함).
- 공개 화면 실측 기록이 PR 본문에 있다(값 없이 수만).
- `git status`의 바뀐 파일이 이 계획의 Files 안에만 있다.
