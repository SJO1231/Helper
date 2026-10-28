// SPEC 8절 시험 배정. 공개 시험 화면의 stage는 제품 seed에 넣지 않으므로(9절) 여기서만 넣는다.
const SITE = 'g2b';
export const TEST_SCREENS = [
  { menuNo: '01033', stage: 'receipt', keyFields: ['oderPlanNo'] },
  { menuNo: '01196', stage: 'bid', keyFields: ['bidPbancUntyNo', 'bidPbancUntyOrd'] },
  { menuNo: '01141', stage: 'contract', keyFields: ['bfSpecRegNo'] },
];

export async function assignTestScreens(core) {
  const keys = TEST_SCREENS.flatMap((s) => s.keyFields.map((key) => ({
    require: { std_key: key },
    fields: { module: 'e2e', stages: [s.stage], type: 'text', label: key, as_column: 1 },
  })));
  await core.put('dict_key', keys);
  // noupdate 없이 보내 이미 자동 등록된 행이 있어도 stage·key_fields를 덮는다.
  await core.put('dict_screen', TEST_SCREENS.map((s) => ({
    require: { site: SITE, menu_no: s.menuNo },
    fields: { stage: s.stage, key_fields: s.keyFields },
  })));
}
