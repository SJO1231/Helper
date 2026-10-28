import type { CoreClient } from '../shared/core-client';
import type { ColumnInfo, KeyType } from '../shared/types';
import { exportCsv, exportFileName, exportXlsx, type ExportQuery } from './export';
import { renderColumnPicker } from './column-picker';
import type { GridHandle } from './grid-adapter';

const KEY_TYPES: KeyType[] = ['text', 'number', 'money', 'percent', 'date', 'datetime', 'bool', 'code'];

export interface ToolbarContext {
  client: CoreClient;
  table: string;
  columns: ColumnInfo[];
  grid: GridHandle;
  currentQuery(): ExportQuery;
  showStatus(text: string, isError?: boolean): void;
}

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function fillOptions(select: HTMLSelectElement, options: { value: string; text: string }[]) {
  select.replaceChildren(
    ...options.map((o) => Object.assign(document.createElement('option'), { value: o.value, textContent: o.text })),
  );
}

function download(blob: Blob, name: string) {
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  link.click();
  URL.revokeObjectURL(link.href);
}

export function fillTableSelect(tables: { id: string; label: string }[], current: string) {
  const select = byId<HTMLSelectElement>('table-select');
  fillOptions(select, tables.map((t) => ({ value: t.id, text: t.label })));
  select.value = current;
  select.addEventListener('change', () => {
    location.search = `?table=${encodeURIComponent(select.value)}`;
  });
}

export function wireToolbar(context: ToolbarContext) {
  const { client, table, columns, grid } = context;
  const columnSelect = byId<HTMLSelectElement>('type-column');
  const typeSelect = byId<HTMLSelectElement>('type-choice');
  fillOptions(columnSelect, columns.map((c) => ({ value: c.id, text: c.fields.label })));
  fillOptions(typeSelect, KEY_TYPES.map((t) => ({ value: t, text: t })));
  const syncType = () => {
    typeSelect.value = columns.find((c) => c.id === columnSelect.value)?.fields.type ?? 'text';
  };
  columnSelect.addEventListener('change', syncType);
  syncType();

  byId('type-apply').addEventListener('click', () => {
    void grid.setColumnType(columnSelect.value, typeSelect.value as KeyType);
  });

  const picker = renderColumnPicker(byId('column-list'), columns, grid);
  byId('columns-reset').addEventListener('click', () => {
    grid.resetColumns();
    picker.sync();
  });

  const exportWith = (build: typeof exportCsv, extension: 'csv' | 'xlsx') => async () => {
    context.showStatus('내보내는 중');
    try {
      const blob = await build(client, table, columns, context.currentQuery());
      download(blob, exportFileName(table, new Date(), extension));
      context.showStatus('내보냈다');
    } catch (error) {
      context.showStatus(error instanceof Error ? error.message : String(error), true);
    }
  };
  byId('export-csv').addEventListener('click', exportWith(exportCsv, 'csv'));
  byId('export-xlsx').addEventListener('click', exportWith(exportXlsx, 'xlsx'));
}
