import type { PageCapture } from '../../plugins/collector/extractor';
import { collectScreen } from './collect';
import { performWorkAction, type WorkActionRequest, type WorkActionResult } from '../../plugins/page-actions/index';
import { createNativeClient, validRequest, type HostClient } from './host';

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const failure = (error: unknown): string => error instanceof Error ? error.message : String(error);
export function isG2bUrl(value?: string): boolean {
  try { const url = new URL(value ?? ''); return ['http:', 'https:'].includes(url.protocol) && (url.hostname === 'g2b.go.kr' || url.hostname.endsWith('.g2b.go.kr')); } catch { return false; }
}

export interface MvpBrowser { runtime: typeof chrome.runtime; tabs: typeof chrome.tabs; scripting: typeof chrome.scripting; userScripts?: typeof chrome.userScripts; }
async function tabFor(api: MvpBrowser, explicit?: number): Promise<chrome.tabs.Tab> {
  if (explicit !== undefined && (!Number.isSafeInteger(explicit) || explicit < 0)) throw new Error('원본 페이지 탭 ID를 확인하세요.');
  const tab = explicit === undefined ? (await api.tabs.query({ active: true, lastFocusedWindow: true }))[0] : await api.tabs.get(explicit);
  if (!tab || tab.id === undefined || !isG2bUrl(tab.url)) throw new Error('현재 나라장터 HTTP/HTTPS 탭에서 실행하세요.');
  return tab;
}
export async function captureTab(api: MvpBrowser, explicit?: number, mode: 'all' | 'skip' = 'all'): Promise<PageCapture> {
  const tab = await tabFor(api, explicit);
  // The top frame reads itself and its direct child frames as one screen, like js.txt (#88).
  const injected = await api.scripting.executeScript({ target: { tabId: tab.id!, frameIds: [0] }, world: 'MAIN', func: collectScreen, args: [null, mode] });
  if (!injected.length) throw new Error('읽을 수 있는 화면 frame이 없습니다.');
  const current = await tabFor(api, tab.id);
  if (current.url !== tab.url) throw new Error('추출 중 페이지가 이동했습니다. 현재 화면에서 다시 추출하세요.');
  const result = injected[0]?.result;
  if (!result) throw new Error('화면을 읽지 못했습니다. 다시 추출하세요.');
  const locations = await api.scripting.executeScript({ target: { tabId: tab.id!, frameIds: injected.map(frame => frame.frameId) }, world: 'MAIN', func: () => window.location.href });
  for (const injection of injected) if (injection.result) {
    const expected = injection.result.frames.find(frame => frame.framePath === 'top')?.url;
    if (!expected || locations.find(frame => frame.frameId === injection.frameId)?.result !== expected) throw new Error('추출 frame이 이동했거나 URL 확인에 실패했습니다. 다시 추출하세요.');
  }
  return result;
}

export async function workTab(api: MvpBrowser, request: WorkActionRequest, explicit?: number): Promise<WorkActionResult> {
  const tab = await tabFor(api, explicit);
  if (!request || !['detect', 'yearShift', 'yearRange', 'setRowCount', 'search', 'excel'].includes(request.kind)) throw new Error('업무 동작 종류를 확인하세요.');
  const inspected = await api.scripting.executeScript({ target: { tabId: tab.id!, allFrames: true }, world: 'MAIN', func: performWorkAction, args: [{ ...request, traverseFrames: false, mode: 'inspect' }] });
  const candidates = inspected.flatMap(frame => frame.result?.candidates ?? []);
  const warnings = inspected.flatMap(frame => (frame.result?.warnings ?? []).map(warning => 'frame ' + frame.frameId + ': ' + warning));
  const matches = inspected.filter(frame => frame.result?.status === 'ready' || frame.result?.status === 'needsSelection');
  if (request.kind === 'detect') return { status: candidates.length ? 'ready' : 'unavailable', candidates, selected: {}, changes: [], clicked: false, warnings, message: candidates.length ? '현재 frame의 업무 요소 후보입니다.' : '업무 요소를 찾지 못했습니다.' };
  if (matches.length > 1 || matches.some(frame => frame.result?.status === 'needsSelection')) return { status: 'needsSelection', candidates, selected: {}, changes: [], clicked: false, warnings, message: '여러 frame/요소 후보가 있습니다. 사용할 화면을 하나만 열거나 요소를 명시하세요.' };
  const selected = matches[0];
  if (!selected?.result) return inspected.find(frame => frame.result?.status === 'invalid')?.result ?? inspected.find(frame => frame.result)?.result ?? { status: 'unavailable', candidates, selected: {}, changes: [], clicked: false, warnings, message: '업무 요소를 찾지 못했습니다.' };
  if (request.mode === 'inspect') return { ...selected.result, candidates, warnings };
  let applyRequest = { ...request, traverseFrames: false, mode: 'apply' as const };
  if (request.kind === 'yearShift') {
    const originalDate = selected.result.selected.startDate?.value ?? '';
    const startYear = /^(\d{4})(?:-?\d{2}){2}$/.exec(originalDate)?.[1];
    if (!startYear || !Number.isInteger(request.years) || Math.abs(request.years!) > 100 || request.years === 0) throw new Error('이동할 조회 연도와 원래 시작일을 확인하세요.');
    applyRequest = { ...applyRequest, kind: 'yearRange', year: Number(startYear) + request.years!, searchAfter: request.searchAfter === true };
  }
  const current = await tabFor(api, tab.id);
  if (current.url !== tab.url) throw new Error('업무 동작 확인 중 페이지가 이동했습니다. 다시 실행하세요.');
  const applied = await api.scripting.executeScript({ target: { tabId: tab.id!, ...(selected.documentId ? { documentIds: [selected.documentId] } : { frameIds: [selected.frameId] }) }, world: 'MAIN', func: performWorkAction, args: [applyRequest] });
  if (applied.length !== 1 || !applied[0].result) throw new Error('업무 동작 실행 frame 결과를 확인할 수 없습니다.');
  return { ...applied[0].result, warnings: [...warnings, ...applied[0].result.warnings] };
}

export async function launcherTab(api: MvpBrowser, script: string, explicit?: number): Promise<unknown> {
  const tab = await tabFor(api, explicit);
  if (typeof script !== 'string' || !script.trim() || script.length > 1024 * 1024) throw new Error('실행할 사용자 스크립트를 확인하세요 (최대 1 MiB 문자).');
  // Chrome 138+: enable extension Details > Allow User Scripts; no eval/CDN execution.
  // Source: https://developer.chrome.com/docs/extensions/reference/api/userScripts#enable-usage-of-the-userscripts-api
  try { if (!api.userScripts) throw new Error('disabled'); await api.userScripts.getScripts(); } catch { throw new Error('확장 관리 → G2B Helper 세부정보 → 사용자 스크립트 허용을 켜세요. Chrome/Edge 138 이상과 나라장터 사이트 접근 권한이 필요합니다.'); }
  return api.userScripts.execute({ target: { tabId: tab.id! }, world: 'MAIN', js: [{ code: script }] });
}

export async function handleMvpMessage(api: MvpBrowser, native: HostClient, message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!object(message) || typeof message.kind !== 'string') throw new Error('MVP 메시지 형식을 확인하세요.');
  const extensionPage = sender.url?.startsWith(api.runtime.getURL('')) === true;
  const widget = sender.tab?.id !== undefined && isG2bUrl(sender.url);
  if (sender.id !== api.runtime.id || (!extensionPage && !widget)) throw new Error('G2B Helper 확장 화면에서만 실행할 수 있습니다.');
  const tabId = widget && !extensionPage ? sender.tab!.id : message.tabId as number | undefined;
  if (message.kind === 'mvp.rpc') {
    if (!validRequest(message.envelope)) throw new Error('MVP Gateway 요청 형식을 확인하세요.');
    if (['mvp.preview', 'mvp.apply'].includes(message.envelope.command)) await tabFor(api, tabId);
    try { return await native.request(message.envelope); }
    catch (error) { throw Object.assign(new Error(failure(error)), { nativeTransport: true }); }
  }
  if (message.kind === 'mvp.context') return { result: { tabId: (await tabFor(api, tabId)).id } };
  if (message.kind === 'mvp.capture') return { result: await captureTab(api, tabId, message.mode === 'skip' ? 'skip' : 'all') };
  if (message.kind === 'mvp.work') return { result: await workTab(api, message.request as unknown as WorkActionRequest, tabId) };
  if (message.kind === 'mvp.launch') return { result: await launcherTab(api, message.script as string, tabId) };
  if (message.kind === 'mvp.open') { await openMode(api, String(message.mode), tabId); return { result: { opened: true } }; }
  throw new Error('지원하지 않는 MVP 명령입니다.');
}

async function openMode(api: MvpBrowser, mode: string, explicit?: number): Promise<void> {
  if (!['collect', 'extract', 'db', 'document', 'launcher'].includes(mode)) throw new Error('열 기능을 확인하세요.');
  const tab = await tabFor(api, explicit);
  try { await api.tabs.sendMessage(tab.id!, { kind: 'mvp.open', mode }, { frameId: 0 }); }
  catch { await api.scripting.executeScript({ target: { tabId: tab.id!, frameIds: [0] }, world: 'ISOLATED', files: ['widget.js'] }); await api.tabs.sendMessage(tab.id!, { kind: 'mvp.open', mode }, { frameId: 0 }); }
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  const api: MvpBrowser = chrome, native = createNativeClient(chrome.runtime);
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (!object(message) || typeof message.kind !== 'string' || !message.kind.startsWith('mvp.')) return false;
    void handleMvpMessage(api, native, message, sender).then(sendResponse, error => sendResponse(message.kind === 'mvp.rpc' ? { protocolVersion: 1, requestId: object(message.envelope) ? message.envelope.requestId : '', error: { code: object(error) && error.nativeTransport ? 'NATIVE_TRANSPORT' : 'REQUEST_DENIED', message: failure(error) } } : { error: failure(error) }));
    return true;
  });
  chrome.action.onClicked.addListener(tab => { if (tab.id !== undefined && isG2bUrl(tab.url)) void chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: 'ISOLATED', files: ['widget.js'] }).catch(console.error); });
  chrome.commands.onCommand.addListener(command => { const mode = command.startsWith('mvp.') ? command.slice(4) : ''; void openMode(api, mode).catch(console.error); });
}
