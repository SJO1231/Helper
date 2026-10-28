# seed 파일 형식

사전 초기 자료. 코어가 설치 때 명령으로만 넣는다(자동 적재 없음).
형식 검사는 `shared/schema/seed.schema.json`.

- 파일 여섯 개: `dict_key.json`, `dict_alias.json`, `dict_label.json`,
  `dict_code.json`, `dict_screen.json`, `dict_child.json`.
- 각 파일은 `{ "rows": [...] }`. 행 모양은 `shared/types.ts`의
  `DictKey`·`DictAlias`·`DictLabel`·`DictCode`·`DictScreen`·`DictChild`.
- 행에 정의되지 않은 필드를 두지 않는다(`dict_screen`은 `dict-screen.schema.json`을 따른다).
- `dict_key.display.source`는 근거 목록(`data_map`·`pclm`·`v4.1`·`ours` 중 하나 이상).
- 키·라벨·타입·코드 뜻·화면 코드·하위 표 ID만 둔다. 공고번호·금액·업체명·기관명 같은 실제 값은 넣지 않는다.

## 출처
- `dict_key.display.source`에 근거를 적는다: `data_map`(화면 분석 자료), `pclm`(필드 설명 문서), `v4.1`(옛 사전), `ours`(우리가 만든 키).
- std_key는 나라장터 필드 ID 그대로(camelCase). 화면별 다른 꼴은 `dict_alias`에 둔다.
  `source`에 `ours`가 없는데 camelCase가 아니면 검사에서 걸린다.

## 값 검사
`npm run seed:check`가 `shared/seed/`의 여섯 파일을 본다. 걸리면 파일·행 번호·규칙 이름만 찍고 종료 코드 1이다.
걸린 값은 출력하지 않는다. 규칙은 `scripts/seed/seed-rules.ts`, 시험 자료는 `fixtures/ok`·`fixtures/bad/<규칙>/`(구조만, 값은 자리표시).
