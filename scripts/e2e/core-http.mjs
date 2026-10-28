// e2e가 판정에 쓰는 코어 HTTP. shared/core-client.ts와 같은 머리(토큰·스키마·요청 ID)로 직접 부른다.
import { randomUUID } from 'node:crypto';

export function createCoreHttp(connection) {
  async function send(method, path, body) {
    const headers = { Authorization: `Bearer ${connection.token}`, 'X-Schema-Version': '1' };
    if (method !== 'GET') headers['X-Request-Id'] = randomUUID();
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(connection.baseUrl + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const reply = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${path.split('?')[0]} → HTTP ${response.status}`);
    return reply;
  }

  return {
    baseUrl: connection.baseUrl,
    status: async (path) => (await fetch(connection.baseUrl + path, {
      headers: { Authorization: `Bearer ${connection.token}`, 'X-Schema-Version': '1' },
    })).status,
    get: (path) => send('GET', path),
    put: (table, records, query = '') => send('PUT', `/api/tables/${table}/records${query}`, { records }),
    post: (table, records) => send('POST', `/api/tables/${table}/records`, { records }),
    async total(table, filter) {
      const query = filter ? `&filter=${encodeURIComponent(JSON.stringify(filter))}` : '';
      return (await send('GET', `/api/tables/${table}/records?limit=1${query}`)).total;
    },
    async columnLabels(table) {
      return (await send('GET', `/api/tables/${table}/columns`)).columns.map((c) => c.fields.label);
    },
    // 모든 테이블의 행 수. 스냅샷이 DB를 건드리지 않았는지 볼 때 쓴다.
    async rowCounts() {
      const { tables } = await send('GET', '/api/tables');
      const counts = {};
      for (const t of tables) counts[t.id] = await this.total(t.id);
      return counts;
    },
  };
}
