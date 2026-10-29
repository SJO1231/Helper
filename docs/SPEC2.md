# SPEC2 — 2단계 끝 기준

docs/SPEC.md는 현재 상태만 적는다(200줄 이하). 이 파일은 2단계 기능의 **끝 기준**만 적는다. 결정 배경은 docs/STAGE2.md, 결정 기록은 docs/DECISIONS.md.
기능이 합쳐지면 그 기능의 현재 동작은 SPEC.md 본문으로 가고, 여기에는 끝 기준과 통과 기록(PR 번호)만 남는다.

## 순서
① 백업 복원 → ② 사전 편집 UI → ③ 미등록 키 승격 → ④ 직링크 →
⑤ 자동수집(버튼 동작 뒤 1회) → ⑥ 메모·일정(E1 승인 뒤) → ⑦ 셀 편집(E3 승인 뒤) → ⑧ 통합 보기 → ⑨ 연락처(보류)

## 끝 기준
각 기능의 PR이 아래 줄을 채운다. 형식: `번호. 기능 — 명령 — 기준 — 통과 PR`.
①. 백업 복원 — pytest core/tests — 백업 뒤 행 추가·복원 시 행 수 동일, schema_version 다르면 거절, 복원 전 보존 파일 — PR #24(#23 포함)
②. 사전 편집 UI — npm run verify·e2e:public — dict 열 편집 시 PATCH 1회·칸 반영, 깨진 JSON PATCH 0회, 기본키 읽기 전용 — PR #24·#28
③. 미등록 키 승격 — npm run e2e:public — 01175 스냅샷의 미등록 키 하나를 올리면 dict_key +1, 다음 스냅샷 미등록 수 −1 — PR #25
④. 직링크 — npm run e2e:public — 13713에서 01175로 이동 시 history.state.data.menuNo = 01175, dict_screen 행 수 불변 — PR #26
⑤. 자동수집 — npm run e2e:public — 스위치 꺼짐: 실제 클릭 뒤 capture 불변 / 켜짐: +1, 한 번 더: 메인 행 불변(capture 0~1) / 수집 버튼 0회 — PR #27
