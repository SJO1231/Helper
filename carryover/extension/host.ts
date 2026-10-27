// The one place that talks to the Helper host (user, 2026-10-14, #96). Only this file knows the transport:
// today Chrome Native Messaging; a later transport (tray, local HTTP) replaces createNativeClient with the same request/dispose shape.
import type { MvpEnvelope, MvpResponse } from './contracts';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (error: unknown): string => error instanceof Error ? error.message : String(error);
export const NATIVE_HOST = 'com.sjo1231.g2b_helper';
const commands = new Set(['mvp.health', 'mvp.preview', 'mvp.apply', 'mvp.records', 'mvp.edit', 'mvp.trash', 'mvp.restore', 'mvp.settings.read', 'mvp.settings.save', 'mvp.reset', 'mvp.columns.remove', 'mvp.document.profiles', 'mvp.document.generate']);
export function validRequest(value: unknown): value is MvpEnvelope { return object(value) && value.protocolVersion === 1 && typeof value.requestId === 'string' && !!value.requestId.trim() && value.requestId.length <= 200 && typeof value.command === 'string' && commands.has(value.command) && object(value.payload); }
function validResponse(value: unknown, requestId: string): value is MvpResponse {
  return object(value) && value.protocolVersion === 1 && value.requestId === requestId && (Object.hasOwn(value, 'result') !== Object.hasOwn(value, 'error')) && (!Object.hasOwn(value, 'error') || (object(value.error) && typeof value.error.code === 'string' && typeof value.error.message === 'string'));
}
interface NativeRuntime { connectNative(name: string): chrome.runtime.Port; lastError?: { message?: string }; }
interface NativeLimits { timeoutMs?: number; requestBytes?: number; responseBytes?: number; }
interface Pending { resolve(value: MvpResponse): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout>; parts: Map<number, string>; total?: number; bytes: number; }

/** Framing is performed by Chrome; host.py sends JSON envelopes or bounded JSON text chunks.
 * Source: https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging */
export function createNativeClient(runtime: NativeRuntime, limits: NativeLimits = {}) {
  const waiting = new Map<string, Pending>();
  const maxRequest = limits.requestBytes ?? 60 * 1024 * 1024, maxResponse = limits.responseBytes ?? 100 * 1024 * 1024;
  let port: chrome.runtime.Port | undefined;
  function finish(id: string, value?: MvpResponse, error?: Error): void {
    const entry = waiting.get(id); if (!entry) return;
    waiting.delete(id); clearTimeout(entry.timer);
    if (error) entry.reject(error); else entry.resolve(value!);
  }
  function connect(): chrome.runtime.Port {
    if (port) return port;
    const connected = runtime.connectNative(NATIVE_HOST); port = connected;
    connected.onMessage.addListener((message: unknown) => {
      if (!object(message) || typeof message.requestId !== 'string' || !waiting.has(message.requestId)) return;
      const id = message.requestId, pending = waiting.get(id)!;
      try {
        if (message.protocolVersion !== 1) throw new Error('Native 응답 프로토콜 버전이 다릅니다.');
        let value: unknown = message;
        if (Object.hasOwn(message, 'chunk')) {
          const chunk = message.chunk;
          if (!object(chunk) || !Number.isSafeInteger(chunk.index) || !Number.isSafeInteger(chunk.total) || (chunk.index as number) < 0 || (chunk.total as number) < 1 || (chunk.total as number) > 4096 || (chunk.index as number) >= (chunk.total as number) || typeof chunk.text !== 'string' || chunk.text.length > 300000) throw new Error('Native 응답 조각 형식/한도가 올바르지 않습니다.');
          const { index, total, text } = chunk as { index: number; total: number; text: string };
          if (pending.total !== undefined && pending.total !== total) throw new Error('Native 응답 조각 개수가 변경되었습니다.');
          pending.total = total;
          if (pending.parts.has(index) && pending.parts.get(index) !== text) throw new Error('Native 응답 조각 내용이 충돌합니다.');
          if (!pending.parts.has(index)) pending.bytes += new TextEncoder().encode(text).byteLength;
          if (pending.bytes > maxResponse) throw new Error('Native 응답 전체 크기 한도를 초과했습니다.');
          pending.parts.set(index, text);
          if (pending.parts.size < total) return;
          value = JSON.parse(Array.from({ length: total }, (_, part) => pending.parts.get(part)!).join(''));
        } else if (new TextEncoder().encode(JSON.stringify(message)).byteLength > maxResponse) throw new Error('Native 응답 전체 크기 한도를 초과했습니다.');
        if (!validResponse(value, id)) throw new Error('Native 응답 요청 ID/결과 형식이 올바르지 않습니다.');
        finish(id, value);
      } catch (error) { finish(id, undefined, new Error(failure(error))); }
    });
    connected.onDisconnect.addListener(() => {
      const detail = runtime.lastError?.message ?? 'Native 연결 종료';
      if (port === connected) port = undefined;
      for (const id of waiting.keys()) finish(id, undefined, new Error('G2B Helper Native Host 연결 실패: ' + detail + '. Native Host 설치와 확장 ID 등록을 확인하세요.'));
    });
    return connected;
  }
  return {
    request(envelope: MvpEnvelope): Promise<MvpResponse> {
      return new Promise((resolve, reject) => {
        if (!validRequest(envelope)) { reject(new Error('MVP Gateway 요청 형식을 확인하세요.')); return; }
        if (waiting.has(envelope.requestId)) { reject(new Error('같은 요청 ID가 이미 처리 중입니다.')); return; }
        try {
          if (new TextEncoder().encode(JSON.stringify(envelope)).byteLength > maxRequest) throw new Error('Native 요청 전체 크기 한도를 초과했습니다.');
          const connection = connect();
          const timer = setTimeout(() => finish(envelope.requestId, undefined, new Error('Native 응답 시간 초과. 동일 요청 ID로 재시도하세요.')), limits.timeoutMs ?? (envelope.command === 'mvp.document.generate' ? 150000 : 45000));
          waiting.set(envelope.requestId, { resolve, reject, timer, parts: new Map(), bytes: 0 });
          connection.postMessage(envelope);
        } catch (error) { if (waiting.has(envelope.requestId)) finish(envelope.requestId, undefined, new Error(failure(error))); else reject(new Error(failure(error))); }
      });
    },
    dispose(): void { for (const id of waiting.keys()) finish(id, undefined, new Error('Native 연결을 닫았습니다.')); const previous = port; port = undefined; previous?.disconnect(); }
  };
}

export type HostClient = ReturnType<typeof createNativeClient>;
