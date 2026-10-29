export const SCHEMA_VERSION = 1;

export type Stage = 'receipt' | 'bid' | 'contract';
export type ExtractMode = 'visible' | 'hidden' | 'all';
export type KeyType = 'text' | 'number' | 'money' | 'percent' | 'date' | 'datetime' | 'bool' | 'code' | 'flag' | 'json';
export type LabelScope = 'user' | 'screen' | 'site' | 'system';

export interface PointField { k: string; v: string; l: string; visible: boolean }
export interface RawTable {
  id: string;
  dataList: string;
  visible: boolean;
  columns: { k: string; l: string }[];
  rows: Record<string, string>[];
}
export interface RawCapture {
  state: Record<string, string>;
  param: Record<string, string>;
  pointInfo: PointField[];
  tables: RawTable[];
}
export interface CaptureFields {
  site: 'g2b';
  menu_no: string;
  scrn_no: string;
  url: string;
  mode: ExtractMode;
  raw: RawCapture;
}
export interface CaptureResult {
  status: 'same' | 'new' | 'changed' | 'rejected';
  record_id: string | null;
  stage: Stage | null;
  changed: string[];
  unknown_keys: number;
  reason?: string;
}

export interface GristRecord<F> { id: string | number; fields: F }
export interface RecordsPage<F> { records: GristRecord<F>[]; total: number }
export interface ColumnInfo { id: string; fields: { label: string; type: KeyType; index: boolean; primary?: boolean } }

export interface DictKey {
  std_key: string;
  module: string;
  stages: string[];
  type: KeyType;
  label: string;
  as_column: 0 | 1;
  index: 0 | 1;
  derived: 0 | 1;
  display: Record<string, unknown>;
}
export interface DictAlias { site: string; screen_code: string | null; source_key: string; std_key: string }
export interface DictLabel { scope: LabelScope; scope_id: string; key: string; label: string }
export interface DictCode { std_key: string; code: string; meaning: string; scope: string }
export interface DictScreen {
  site: string;
  menu_no: string;
  scrn_no: string;
  menu_cang_val: string;
  name: string;
  stage: Stage | null;
  source_route: string;
  key_fields: string[];
  link: unknown;
  options: unknown;
}
export interface DictChild {
  site: string;
  table_code: string;
  alias: string;
  stage: Stage | null;
  typed: 0 | 1;
  key_fields: string[];
}

export interface SeedFile<Row> { rows: Row[] }

export interface UnknownKey { k: string; l: string }
export interface Diagnostics {
  forms: number;
  grids: number;
  droppedEmptyRef: number;
  droppedSameDataList: number;
  failedGrids: number;
  droppedParam: number;
  unknownKeys: number;
  core: 'ok' | 'offline';
}
export interface ConnectionInfo { baseUrl: string; token: string }
