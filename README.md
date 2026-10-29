# helper

나라장터(G2B) 업무 화면을 읽어 로컬 SQLite에 모으고 엑셀처럼 보는 브라우저 확장 + 로컬 서비스.

- 규칙: `AGENTS.md` (Claude Code는 `CLAUDE.md`가 이를 가리킴)
- 절차: `docs/PROCESS.md`
- 현재 사양: `docs/SPEC.md`
- 결정 기록: `docs/DECISIONS.md`
- 방향·설계: `PLAN.md`, 세션 운영: `GUIDE.md`, 주의: `CAUTIONS.md`
- 옛 저장소에서 가져온 것: `carryover/` (쓰임은 `carryover/README.md`)

## 설치
1. 빌드: `npm run build`
2. Native host 등록: `scripts/install-host.ps1`
3. Chrome 확장 페이지에서 "압축 해제된 확장 프로그램"으로 `dist/extension`을 올린다.
4. 백업·복원: `python -m core.backup make` / `python -m core.backup restore`
