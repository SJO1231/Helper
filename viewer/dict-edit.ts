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

export function createCellEditHandler(client: CoreClient, table: string, report: ReportStatus) {
  return async (event: CellEditRequest): Promise<void> => {
    const field = event.colDef.field;
    const value = event.newValue ?? '';
    if (!field || value === event.data[field]) return;
    try {
      await client.patchRecords(table, [{ id: Number(event.data[ROW_ID_FIELD]), fields: { [field]: value } }]);
    } catch (error) {
      // 격자는 값을 바꾸지 않았으므로 칸은 원래 값 그대로다.
      report(describeFailure(error), true);
      return;
    }
    // PATCH 응답에는 값이 없고 id뿐이라, 보낸 값을 그대로 칸에 둔다.
    event.node.updateData({ ...event.data, [field]: value });
    report('저장됨');
  };
}
