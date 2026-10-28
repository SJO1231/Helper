/// <reference types="chrome" />
// Native Messaging 전송 한 곳. 프레임 규칙은 carryover/extension/host.ts를 그대로 따른다:
// 큰 응답은 {protocolVersion:1, requestId, chunk:{index,total,text}} 조각으로 오고 requestId로 모은다.
// 조각이 아닌 응답은 SPEC 4.1의 메시지 그대로 오므로 가장 먼저 보낸 요청의 답으로 본다(한 번에 하나씩 보낸다).
export const NATIVE_HOST = 'com.helper.core';

const MAX_RESPONSE_BYTES = 100 * 1024 * 1024;
const MAX_CHUNKS = 4096;
const MAX_CHUNK_TEXT = 300_000;
const TIMEOUT_MS = 45_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

interface NativeRuntime {
  connectNative(name: string): chrome.runtime.Port;
  lastError?: { message?: string };
}
interface Pending {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
  parts: Map<number, string>;
  total?: number;
  bytes: number;
}

function checkChunk(chunk: unknown): { index: number; total: number; text: string } {
  const c = chunk as { index: number; total: number; text: string };
  const valid = isObject(chunk) && Number.isSafeInteger(c.index) && Number.isSafeInteger(c.total)
    && c.index >= 0 && c.total >= 1 && c.total <= MAX_CHUNKS && c.index < c.total
    && typeof c.text === 'string' && c.text.length <= MAX_CHUNK_TEXT;
  if (!valid) throw new Error('Native 응답 조각 형식/한도가 올바르지 않습니다.');
  return c;
}

function addChunk(pending: Pending, frame: Record<string, unknown>): unknown | undefined {
  const { index, total, text } = checkChunk(frame.chunk);
  if (pending.total !== undefined && pending.total !== total) throw new Error('Native 응답 조각 개수가 변경되었습니다.');
  pending.total = total;
  if (pending.parts.has(index) && pending.parts.get(index) !== text) throw new Error('Native 응답 조각이 충돌합니다.');
  if (!pending.parts.has(index)) pending.bytes += byteLength(text);
  if (pending.bytes > MAX_RESPONSE_BYTES) throw new Error('Native 응답 전체 크기 한도를 초과했습니다.');
  pending.parts.set(index, text);
  if (pending.parts.size < total) return undefined;
  return JSON.parse(Array.from({ length: total }, (_, part) => pending.parts.get(part)!).join(''));
}

export function createNativeClient(runtime: NativeRuntime, newId: () => string = () => crypto.randomUUID()) {
  const waiting = new Map<string, Pending>();
  let port: chrome.runtime.Port | undefined;

  function finish(id: string, value?: unknown, error?: Error): void {
    const entry = waiting.get(id);
    if (!entry) return;
    waiting.delete(id);
    clearTimeout(entry.timer);
    if (error) entry.reject(error);
    else entry.resolve(value);
  }

  function onMessage(message: unknown): void {
    if (!isObject(message)) return;
    try {
      if (Object.hasOwn(message, 'chunk')) {
        const id = String(message.requestId);
        const pending = waiting.get(id);
        if (!pending) return;
        try {
          const whole = addChunk(pending, message);
          if (whole !== undefined) finish(id, whole);
        } catch (error) {
          finish(id, undefined, error as Error);
        }
        return;
      }
      const oldest = waiting.keys().next();
      if (oldest.done) return;
      if (typeof message.error === 'string') finish(oldest.value, undefined, new Error(message.error));
      else finish(oldest.value, message);
    } catch (error) {
      for (const id of waiting.keys()) finish(id, undefined, error as Error);
    }
  }

  function connect(): chrome.runtime.Port {
    if (port) return port;
    const connected = runtime.connectNative(NATIVE_HOST);
    port = connected;
    connected.onMessage.addListener(onMessage);
    connected.onDisconnect.addListener(() => {
      const detail = runtime.lastError?.message ?? 'Native 연결 종료';
      if (port === connected) port = undefined;
      for (const id of Array.from(waiting.keys())) {
        finish(id, undefined, new Error(`Helper Native Host 연결 실패: ${detail}. 호스트 설치와 확장 ID 등록을 확인하세요.`));
      }
    });
    return connected;
  }

  return {
    request(message: Record<string, unknown>): Promise<unknown> {
      return new Promise((resolve, reject) => {
        const requestId = newId();
        try {
          const connection = connect();
          const timer = setTimeout(() => finish(requestId, undefined, new Error('Native 응답 시간 초과')), TIMEOUT_MS);
          waiting.set(requestId, { resolve, reject, timer, parts: new Map(), bytes: 0 });
          connection.postMessage({ ...message, requestId });
        } catch (error) {
          finish(requestId, undefined, error as Error);
          reject(error);
        }
      });
    },
    dispose(): void {
      for (const id of Array.from(waiting.keys())) finish(id, undefined, new Error('Native 연결을 닫았습니다.'));
      const previous = port;
      port = undefined;
      previous?.disconnect();
    },
  };
}

export type HostClient = ReturnType<typeof createNativeClient>;
