import { SCHEMA_VERSION } from './types';
import type { CaptureFields, CaptureResult, ColumnInfo, GristRecord, RecordsPage, Stage } from './types';

export class CoreError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export class CoreOfflineError extends Error {}

export interface CoreClientOptions {
  baseUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  newId?: () => string;
}

export interface RecordsQuery {
  sort?: string;
  filter?: Record<string, string[]>;
  limit?: number;
  offset?: number;
}

export interface CoreClient {
  listTables(): Promise<GristRecord<{ label: string; stage: Stage | null; kind: string }>[]>;
  listColumns(table: string): Promise<ColumnInfo[]>;
  getRecords(table: string, q?: RecordsQuery): Promise<RecordsPage<Record<string, string>>>;
  postCapture(fields: CaptureFields): Promise<CaptureResult>;
  putRecords(
    table: string,
    records: { require: object; fields: object }[],
    opts?: { noupdate?: boolean },
  ): Promise<(string | number)[]>;
  patchRecords(table: string, records: GristRecord<object>[]): Promise<(string | number)[]>;
}

const DEFAULT_LIMIT = 500;
// 첫 시도 뒤 같은 request id로 두 번 더 보낸다. 코어가 같은 id의 응답을 저장해 두므로 안전하다.
const NETWORK_RETRIES = 2;

export function createCoreClient(opts: CoreClientOptions): CoreClient {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const newId = opts.newId ?? (() => crypto.randomUUID());

  async function send(method: string, path: string, body?: unknown): Promise<any> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.token}`,
      'X-Schema-Version': String(SCHEMA_VERSION),
    };
    const isWrite = method !== 'GET';
    if (isWrite) headers['X-Request-Id'] = newId();
    const init: RequestInit = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const attempts = isWrite ? 1 + NETWORK_RETRIES : 1;
    for (let attempt = 1; ; attempt++) {
      try {
        return await readReply(await fetchImpl(opts.baseUrl + path, init));
      } catch (error) {
        if (error instanceof CoreError) throw error;
        if (attempt >= attempts) throw new CoreOfflineError(String(error));
      }
    }
  }

  const recordsPath = (table: string) => `/api/tables/${encodeURIComponent(table)}/records`;
  const idsOf = (reply: { records: { id: string | number }[] }) => reply.records.map((r) => r.id);

  return {
    async listTables() {
      return (await send('GET', '/api/tables')).tables;
    },
    async listColumns(table) {
      return (await send('GET', `/api/tables/${encodeURIComponent(table)}/columns`)).columns;
    },
    async getRecords(table, q = {}) {
      const params = new URLSearchParams();
      if (q.sort) params.set('sort', q.sort);
      if (q.filter) params.set('filter', JSON.stringify(q.filter));
      params.set('limit', String(q.limit ?? DEFAULT_LIMIT));
      params.set('offset', String(q.offset ?? 0));
      return send('GET', `${recordsPath(table)}?${params}`);
    },
    async postCapture(fields) {
      const reply = await send('POST', recordsPath('g2b_capture'), { records: [{ fields }] });
      return reply.records[0].fields;
    },
    async putRecords(table, records, putOpts = {}) {
      const query = putOpts.noupdate ? '?noupdate=true' : '';
      return idsOf(await send('PUT', recordsPath(table) + query, { records }));
    },
    async patchRecords(table, records) {
      return idsOf(await send('PATCH', recordsPath(table), { records }));
    },
  };
}

async function readReply(response: Response): Promise<any> {
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // 서버 오류 페이지처럼 JSON이 아닌 몸통은 상태 코드만으로 오류를 만든다.
  }
  if (!response.ok) throw new CoreError(body?.error ?? `HTTP ${response.status}`, response.status);
  return body;
}
