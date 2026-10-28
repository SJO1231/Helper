import type { CoreClient } from '../shared/core-client';
import type { ColumnInfo } from '../shared/types';

export type CodeMeanings = Record<string, Record<string, string>>;

const MAX_LIMIT = 5000;

// 뜻은 보기 편의라서 못 받아도 원값이 그대로 보이게 둔다.
export async function loadCodeMeanings(
  client: Pick<CoreClient, 'getRecords'>,
  columns: ColumnInfo[],
): Promise<CodeMeanings> {
  const codeColumns = columns.filter((c) => c.fields.type === 'code').map((c) => c.id);
  if (codeColumns.length === 0) return {};
  try {
    const page = await client.getRecords('dict_code', { filter: { std_key: codeColumns }, limit: MAX_LIMIT });
    const meanings: CodeMeanings = {};
    for (const { fields } of page.records) {
      const forColumn = (meanings[fields.std_key] ??= {});
      forColumn[fields.code] ??= fields.meaning;
    }
    return meanings;
  } catch {
    return {};
  }
}
