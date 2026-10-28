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
