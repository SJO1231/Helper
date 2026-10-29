import { describe, expect, test } from 'vitest';
import { createConnection } from './connection';
import type { SessionStore } from './connection';

describe('connection', () => {
  test('simultaneous callers share one hello', async () => {
    let saved: any = null;
    const store: SessionStore = {
      get: async () => saved,
      set: async (info) => void (saved = info),
    };
    let hellos = 0;
    const host = {
      request: async () => {
        hellos++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { port: 1234, token: 'T' };
      },
    };
    const connection = createConnection({ host, store });
    const calls = [connection.getConnection(), connection.getConnection(), connection.getConnection(true)];
    const results = await Promise.all(calls);
    expect(hellos).toBe(1);
    expect(new Set(results.map((r) => r.token))).toEqual(new Set(['T']));
  });
});
