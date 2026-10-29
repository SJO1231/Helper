// 사전(dict_*) 칸 편집. 칸을 고칠 때마다 PATCH 한 번이고, 격자는 값을 스스로 바꾸지 않는다(readOnlyEdit).
import { CoreOfflineError } from '../shared/core-client';
import type { CoreClient } from '../shared/core-client';

// 코어가 dict 행에 주는 id(rowid)를 행 자료에 싣는 열 이름. 사전 열 이름과 겹치지 않는다.
export const ROW_ID_FIELD = '_id';

export interface CellEditRequest {
  data: Record<string, string>;
  colDef: { field?: string };
  newValue: string | null | undefined;
  node: { updateData(data: Record<string, string>): void };
}

export type ReportStatus = (text: string, isError?: boolean) => void;

function describeFailure(error: unknown): string {
  if (error instanceof CoreOfflineError) return '코어 꺼짐';
  return error instanceof Error ? error.message : String(error);
}

type Converted = { ok: true; value: unknown; shown: string } | { ok: false; reason: string };

// 격자 편집기는 글자만 주므로, 코어가 받는 형(0/1·JSON·null)으로 바꿔 보낸다.
function convertEdited(kind: string | undefined, text: string): Converted {
  if (text.trim() === '') return { ok: true, value: null, shown: '' };
  if (kind === 'flag') {
    const flag = text.trim();
    if (flag !== '0' && flag !== '1') return { ok: false, reason: '0 또는 1만 쓸 수 있다' };
    return { ok: true, value: Number(flag), shown: flag };
  }
  if (kind === 'json') {
    try {
      const parsed: unknown = JSON.parse(text);
      return { ok: true, value: parsed, shown: JSON.stringify(parsed) };
    } catch {
      return { ok: false, reason: 'JSON 형식이 아니다' };
    }
  }
  return { ok: true, value: text, shown: text };
}

export function createCellEditHandler(
  client: CoreClient,
  table: string,
  report: ReportStatus,
  kinds: Record<string, string> = {},
) {
  return async (event: CellEditRequest): Promise<void> => {
    const field = event.colDef.field;
    const text = event.newValue ?? '';
    if (!field || text === String(event.data[field] ?? '')) return;
    const converted = convertEdited(kinds[field], text);
    if (!converted.ok) return report(converted.reason, true);
    try {
      const record = { id: Number(event.data[ROW_ID_FIELD]), fields: { [field]: converted.value } };
      await client.patchRecords(table, [record]);
    } catch (error) {
      // 격자는 값을 바꾸지 않았으므로 칸은 원래 값 그대로다.
      report(describeFailure(error), true);
      return;
    }
    // PATCH 응답에는 값이 없고 id뿐이라, 보낸 값을 행 자료에 둔다.
    // readOnlyEdit에서는 setDataValue가 값을 안 바꾸고 cellEditRequest를 다시 내서 PATCH가 되풀이된다.
    event.node.updateData({ ...event.data, [field]: converted.shown });
    report('저장됨');
  };
}
