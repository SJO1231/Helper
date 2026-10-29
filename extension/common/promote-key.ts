import type { CoreClient } from '../../shared/core-client';
import type { RawCapture, UnknownKey } from '../../shared/types';

// 미등록 키를 사전에 올린다. 열 생성(as_column)·alias·이름 바꾸기는 사전 편집 화면의 일이다.
export function unknownKeyList(raw: RawCapture, unknownKs: string[]): UnknownKey[] {
  const labelOf = new Map<string, string>();
  for (const f of raw.pointInfo) if (!labelOf.has(f.k)) labelOf.set(f.k, f.l);
  for (const t of raw.tables) for (const c of t.columns) if (!labelOf.has(c.k)) labelOf.set(c.k, c.l);
  return unknownKs.map((k) => ({ k, l: labelOf.get(k) || k }));
}

// SPEC 6절 해석 순서가 K의 마지막 '.' 뒤 이름을 보므로 표준키 이름도 그 이름이다.
export const stdKeyNameOf = (k: string): string => k.slice(k.lastIndexOf('.') + 1);

export async function promoteKey(core: CoreClient, k: string, label: string, stage: string | null): Promise<string> {
  const stdKey = stdKeyNameOf(k);
  const fields = { std_key: stdKey, label, stages: stage ? [stage] : [], type: 'text', as_column: 0 };
  await core.putRecords('dict_key', [{ require: { std_key: stdKey }, fields }], { noupdate: true });
  return stdKey;
}
