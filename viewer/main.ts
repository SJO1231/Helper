import { CoreOfflineError, createCoreClient } from '../shared/core-client';
import { loadCodeMeanings } from './code-labels';
import { createCellEditHandler, ROW_ID_FIELD } from './dict-edit';
import { getConnectionFromBackground } from './connection';
import { mountGrid } from './grid-adapter';
import { createPagedSource } from './paged-source';
import { fillTableSelect, wireToolbar } from './toolbar';

const status = document.getElementById('status') as HTMLElement;

function showStatus(text: string, isError = false) {
  status.textContent = text;
  status.classList.toggle('error', isError);
}

function describeFailure(error: unknown): string {
  if (error instanceof CoreOfflineError) return '코어 꺼짐';
  return error instanceof Error ? error.message : String(error);
}

// 막힌 저장소는 접근만 해도 던진다. 그럴 땐 저장 없이 뜬다.
function columnStorage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

async function start() {
  const connection = await getConnectionFromBackground();
  const client = createCoreClient(connection);
  const tables = await client.listTables();
  if (tables.length === 0) return showStatus('볼 테이블이 없다', true);

  const choices = tables.map((t) => ({ id: String(t.id), label: t.fields.label, kind: t.fields.kind }));
  const asked = new URLSearchParams(location.search).get('table');
  const table = (choices.find((t) => t.id === asked) ?? choices.find((t) => t.kind === 'main') ?? choices[0]).id;
  fillTableSelect(choices, table);

  const columns = await client.listColumns(table);
  const codeMeanings = await loadCodeMeanings(client, columns);
  const isDict = choices.find((t) => t.id === table)?.kind === 'dict';
  const source = createPagedSource(client, table, undefined, isDict ? ROW_ID_FIELD : undefined);
  const edit = isDict ? { kind: 'dict', onEdit: createCellEditHandler(client, table, showStatus) } : undefined;
  const grid = mountGrid(document.getElementById('grid') as HTMLElement, columns, source, {
    onTotal: (total) => showStatus(`${total.toLocaleString()}행`),
    onError: (error) => showStatus(describeFailure(error), true),
  }, { columnMemory: { table, storage: columnStorage() }, codeMeanings, edit });
  wireToolbar({ client, table, columns, grid, currentQuery: () => source.currentQuery(), showStatus });

  // bench가 열 타입 변경 시간을 재려고 쓴다. 평소 화면에는 내놓지 않는다.
  if (new URLSearchParams(location.search).has('bench')) {
    Object.assign(window, { __bench: { setColumnType: grid.setColumnType, columnCount: grid.columnCount } });
  }
}

start().catch((error) => showStatus(describeFailure(error), true));
