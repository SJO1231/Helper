import type { ConnectionInfo } from '../shared/types';

// @types/chrome를 들이지 않고 이 파일이 쓰는 면만 적는다.
interface ChromeRuntime {
  lastError?: { message?: string };
  sendMessage(message: unknown, callback: (reply: unknown) => void): void;
}
declare const chrome: { runtime: ChromeRuntime };

export function getConnectionFromBackground(): Promise<ConnectionInfo> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ kind: 'core.connection' }, (reply) => {
      const failure = chrome.runtime.lastError;
      if (failure) return reject(new Error(failure.message ?? '확장 background에 닿지 않는다'));
      const info = reply as Partial<ConnectionInfo> | undefined;
      if (!info?.baseUrl || !info.token) return reject(new Error('코어 연결 정보를 받지 못했다'));
      resolve({ baseUrl: info.baseUrl, token: info.token });
    });
  });
}
