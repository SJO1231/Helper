# carryover — 옛 G2B_Helper에서 새 저장소로 가져갈 것

출처와 커밋은 `SOURCE.txt`. 여기 파일은 **복사본**이며 옛 저장소는 그대로다.
새 세션은 이 폴더에서 "그대로 쓰는 것"만 읽는다. "패턴만"과 `reference/`는 질문이 생겼을 때만 연다.

| 파일 | 어디서 | 어떻게 쓰나 |
|---|---|---|
| extension/collect.ts | apps/mvp | **그대로 쓴다.** js.txt를 옮긴 47줄 추출기. 새 버전은 여기에 `getHeaderValue`(라벨)와 빈 ref 제외 규칙만 더한다 |
| extension/host.ts | apps/mvp | **그대로 쓴다.** Native Messaging 전송: 조각 조립, 크기 제한, 타임아웃, 명령 허용 목록 |
| extension/bridge.ts | apps/mvp | **그대로 쓴다.** 같은 requestId로 재시도하는 RPC |
| extension/background.ts | apps/mvp | **패턴만.** 보낸 쪽 검사, `chrome.scripting.executeScript(world:'MAIN')`, 캡처 중 페이지 이동 거절 |
| extension/contracts.ts | apps/mvp | **패턴만.** 메시지 타입 모양 |
| extension/bridge.test.ts, extraction.test.ts | tests/mvp | **패턴만.** mockWebSquare로 추출기를 시험하는 방법 |
| native/host.py | native | **그대로 쓴다(상단 import만 바꿈).** `native_loop` 프레이밍. `from pce.gateway import Gateway` 줄은 옛 코드라 지운다 |
| native/mvp_host.py | native | **그대로 쓴다.** 진입점 24줄 |
| native/mvp.py | native/pce | **패턴만. DB 구조는 버린다.** 요청 기록(mvp_requests)·CAS(store_version)·휴지통·WAL·RLock·executescript 금지 패턴만 가져온다. 키마다 컬럼 만드는 부분은 쓰지 않는다 |
| native/test_mvp.py | native/tests | **패턴만.** 원자성·재시도·재시작 시험 짜는 법 |
| native/requirements*.txt | native | 그대로 |
| scripts/build-mvp.mjs | scripts | **그대로 쓴다.** esbuild 번들 + manifest 생성 + 고정 key 검증 |
| scripts/package-mvp.mjs | scripts | **그대로 쓴다.** 허용 목록 zip, 심볼릭 링크·DB·참고자료 거절, 바이트 검증 |
| scripts/install-mvp-host.ps1 | scripts | **그대로 쓴다.** HKCU만 등록 |
| scripts/mvp-extension-key.json | scripts | **그대로 쓴다.** 확장 공개 key(ID 고정용) |
| scripts/verify-mvp-archive.py | scripts | 그대로 |
| scripts/verify-mvp-ui.mjs | scripts | **패턴만.** Playwright로 확장 페이지를 가짜 전송과 함께 띄우는 방법 |
| reference/js.txt | 참고자료/새 폴더 | **추출 기준 원본.** 추출 규칙이 헷갈리면 이것이 정답 |
| reference/MVP.md | docs | **옛 결정 기록. 새 세션 시작 컨텍스트에 넣지 않는다.** 특정 결정(예: 하위 표 이름)을 찾을 때만 검색한다 |
| reference/GLOSSARY.md | docs | 끝의 "2026-10-09 용어 규칙"만 유효: DB 테이블(SQLite) / 표(화면 그리드) |
| reference/AGENTS.md | 루트 | 옛 하네스. 네 원칙(코딩 전 확인·최소 구현·필요한 파일만·실행으로 검증)만 새 CLAUDE.md로 옮긴다 |
| reference/issues.json | GitHub | 옛 이슈 제목 목록. "이거 전에 결정했나?" 확인용 |

가져오지 않은 것: grid.ts(자체 편집기), apps/extension·bookmarklet·ui·plugins(2세대 레거시), docs/STATUS·ARCHITECTURE·DECISIONS·P00, Studio 문서 연결, 참고자료의 실제 업무 파일(값 포함, 저장소 밖에 둠).
