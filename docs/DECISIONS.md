2026-10-28 새 저장소 시작. 옛 G2B_Helper는 참고용 동결.
2026-10-28 저장소는 하나(E:/Prodev/Helper, GitHub SJO1231/Helper). 템플릿(옵시디언 플러그인 포함)·엑셀 연동도 같은 저장소 폴더로. HWPX·데스크탑 메모 상세만 별도.
2026-10-28 템플릿 편집기는 독립 완결 도구로 만든다. 옵시디언 플러그인은 그 위의 껍데기.
2026-10-28 엑셀 연동 순서: 바깥 제어(openpyxl·xlwings, 추가 기능 없음) → helper.xlam 리본(회사 매크로 정책 확인 뒤). VBA는 버튼·보호·범위 넘기기만, 논리는 Python.
2026-10-28 이 폴더의 플러그인: superpowers·mattpocock 켬, oh-my-claudecode·ponytail 끔. carryover/는 편집 금지.
2026-10-28 CI·리뷰 봇은 검증 명령이 생기는 S5에서 만든다. 빈 CI는 만들지 않는다.

2026-10-28 S0 가능성 시험 결과는 docs/feasibility.md. 안 됨 0, 조건부 4(화면 식별·자동 순회·탭 전환·행 높이), 로그인 화면은 모름.
2026-10-28 scripts/probe-public.mjs는 package.json 없이 `npm i --no-save playwright-core`로 돈다. package.json은 S5에서 검증 명령과 함께 만든다.
나중: PLAN.md 0단계 선행 실측 표의 탭·행 높이·글꼴 줄을 feasibility.md 기준으로 고친다.
나중: 발주계획·사전규격공개는 scrnNo가 같으므로 dict 화면 키에 검색유형 값을 더할지 S1에서 정한다.
2026-10-28 S0 상세 화면 확인: 목록 링크 6가지 모두 같은 창 전환, 뒤로가기로 복원. 안 됨 0. 결과는 docs/feasibility.md 상세 화면 절.
2026-10-28 probe 본문 판정을 id 접두어에서 DOM 포함(#mf_wfm_container 안)으로 바꿨다. 이유: 첨부파일 그리드 id가 wq_uuid_N_로 시작.
2026-10-28 probe 스크립트를 scripts/probe/ 아래 3파일 + 실행 파일로 나눴다. 이유: AGENTS.md 300줄·120자 규칙.
나중: 상세 화면 업무키는 history.state.data.param에서 읽는 안을 S1에서 검토한다(목록 행 전체 또는 키 2개가 실림).
나중: 입찰공고목록은 행마다 상세 화면 코드가 다르다(연계기관 06349 / 통합 06085). dict 화면 키 설계 때 반영.
