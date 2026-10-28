import type { ConnectionInfo } from '../shared/types';

// @types/chrome를 들이지 않고 이 파일이 쓰는 면만 적는다.
interface ChromeRuntime {
  lastError?: { message?: string };
  sendMessage(message: unknown, callback: (reply: unknown) => void): void;
}
// background는 {ok:true,data} 또는 {ok:false,code,error}로 답한다(extension/common/background.ts).
interface BackgroundReply {
  ok: boolean;
  data?: Partial<ConnectionInfo>;
  error?: string;
}
declare const chrome: { runtime: ChromeRuntime };

export function getConnectionFromBackground(): Promise<ConnectionInfo> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ kind: 'core.connection' }, (reply) => {
      const failure = chrome.runtime.lastError;
      if (failure) return reject(new Error(failure.message ?? '확장 background에 닿지 않는다'));
      const answer = reply as BackgroundReply | undefined;
      if (answer?.ok === false) return reject(new Error(answer.error ?? '코어 연결 정보를 받지 못했다'));
      const info = answer?.data;
      if (!info?.baseUrl || !info.token) return reject(new Error('코어 연결 정보를 받지 못했다'));
      resolve({ baseUrl: info.baseUrl, token: info.token });
    });
  });
}
