import { afterEach, describe, expect, test, vi } from 'vitest';
import { getConnectionFromBackground } from './connection';

function stubChrome(reply: unknown, lastError?: string) {
  const sent: unknown[] = [];
  vi.stubGlobal('chrome', {
    runtime: {
      get lastError() {
        return lastError ? { message: lastError } : undefined;
      },
      sendMessage: (message: unknown, callback: (r: unknown) => void) => {
        sent.push(message);
        callback(reply);
      },
    },
  });
  return sent;
}

afterEach(() => vi.unstubAllGlobals());

describe('getConnectionFromBackground', () => {
  test('asks background with kind core.connection and returns its answer', async () => {
    const sent = stubChrome({ ok: true, data: { baseUrl: 'http://127.0.0.1:1', token: 'T' } });
    await expect(getConnectionFromBackground()).resolves.toEqual({ baseUrl: 'http://127.0.0.1:1', token: 'T' });
    expect(sent).toEqual([{ kind: 'core.connection' }]);
  });

  test('a runtime error becomes a readable failure', async () => {
    stubChrome(undefined, 'no receiver');
    await expect(getConnectionFromBackground()).rejects.toThrow('no receiver');
  });

  test('a refusal from background keeps its message', async () => {
    stubChrome({ ok: false, code: 'offline', error: '코어 꺼짐' });
    await expect(getConnectionFromBackground()).rejects.toThrow('코어 꺼짐');
  });

  test('an answer without a token is refused', async () => {
    stubChrome({ ok: true, data: { baseUrl: 'http://127.0.0.1:1' } });
    await expect(getConnectionFromBackground()).rejects.toThrow('코어 연결 정보');
  });
});
