import { CoreError, CoreOfflineError, createCoreClient } from '../../shared/core-client';
import type { CoreClient } from '../../shared/core-client';
import type { ConnectionInfo } from '../../shared/types';

// 토큰은 브라우저를 닫으면 사라지는 session 저장소에만 둔다.
export interface SessionStore {
  get(): Promise<ConnectionInfo | null>;
  set(info: ConnectionInfo | null): Promise<void>;
}

export interface ConnectionDeps {
  host: { request(message: Record<string, unknown>): Promise<unknown> };
  store: SessionStore;
  fetchImpl?: typeof fetch;
}

function parseHello(reply: unknown): ConnectionInfo {
  const r = reply as { port?: unknown; token?: unknown } | null;
  if (!r || !Number.isInteger(r.port) || typeof r.token !== 'string' || !r.token) {
    throw new Error('Native hello 응답 형식이 올바르지 않습니다.');
  }
  return { baseUrl: `http://127.0.0.1:${r.port}`, token: r.token };
}

export function createConnection(deps: ConnectionDeps) {
  async function getConnection(refresh = false): Promise<ConnectionInfo> {
    if (!refresh) {
      const saved = await deps.store.get();
      if (saved) return saved;
    }
    let info: ConnectionInfo;
    try {
      info = parseHello(await deps.host.request({ type: 'hello' }));
    } catch (error) {
      await deps.store.set(null);
      throw new CoreOfflineError(String(error));
    }
    await deps.store.set(info);
    return info;
  }

  // 토큰이 바뀌었거나(401) 서비스가 다시 떴을 때(연결 실패) 새 hello로 한 번만 다시 붙는다.
  async function withCore<T>(call: (core: CoreClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const { baseUrl, token } = await getConnection(attempt > 0);
      try {
        return await call(createCoreClient({ baseUrl, token, fetchImpl: deps.fetchImpl }));
      } catch (error) {
        const stale = (error instanceof CoreError && error.status === 401) || error instanceof CoreOfflineError;
        if (attempt > 0 || !stale) throw error;
      }
    }
  }

  return { getConnection, withCore };
}

export type Connection = ReturnType<typeof createConnection>;
