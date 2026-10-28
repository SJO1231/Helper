/// <reference types="chrome" />
import type { Diagnostics, DictScreen, ExtractMode } from '../../shared/types';
import { ROW_COUNT_CHOICES } from '../sites/g2b/remote-actions';
import type { CaptureReply, Reply } from './background';
import { formatCaptureResult, formatDiagnostics, formatFailure } from './diagnostics';
import { renderSnapshot } from './snapshot-view';
import type { SnapshotData } from './snapshot-view';

export interface RemoteDeps {
  doc: Document;
  send: (message: Record<string, unknown>) => Promise<Reply<any>>;
}
export interface ScreenChange { menuNo: string; scrnNo: string; menuCangVal: string; menuNm: string }

const MODES: [ExtractMode, string][] = [['visible', '보이는 것만'], ['hidden', '숨김 포함'], ['all', '전체']];
const TOAST_MS = 4000;
const EMPTY_DIAG: Diagnostics = {
  forms: 0, grids: 0, droppedEmptyRef: 0, droppedSameDataList: 0, failedGrids: 0,
  droppedParam: 0, unknownKeys: 0, core: 'ok',
};

const STYLE = `
:host { all: initial; }
.bar { position: fixed; top: 80px; right: 12px; z-index: 2147483647; width: 230px; padding: 8px;
  font: 12px/1.4 sans-serif; color: #1a1a1a; background: #fff; border: 1px solid #888; border-radius: 6px; }
.bar > * { margin: 2px 0; }
.row { display: flex; gap: 4px; align-items: center; }
.row > * { flex: 1; min-width: 0; }
[data-role="diagnostics"] { color: #444; word-break: keep-all; }
[data-role="toast"] { color: #0a5; font-weight: bold; }
[data-role="snapshot"] { position: fixed; inset: 5%; z-index: 2147483647; overflow: auto; padding: 12px;
  font: 12px/1.4 sans-serif; color: #1a1a1a; background: #fff; border: 2px solid #555; }
table { border-collapse: collapse; margin-bottom: 12px; }
th, td { border: 1px solid #ccc; padding: 2px 6px; text-align: left; white-space: nowrap; }
th { background: #eee; position: sticky; top: 0; }
`;

export function createRemote(deps: RemoteDeps) {
  const { doc, send } = deps;
  const state = {
    screen: null as DictScreen | null,
    menuNo: null as string | null,
    screenKnown: false, // 화면 사전 조회가 성공했는지. 코어가 꺼져 있었다면 false라 수집을 눌러 다시 묻는다
    lookupSeq: 0,
    diag: null as Diagnostics | null,
    registeredScreens: 0,
    restored: 0,
    busy: false,
  };
  const host = doc.createElement('div');
  host.id = 'helper-remote';
  doc.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });

  function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = '') {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    node.textContent = text;
    return node;
  }
  const button = (action: string, text: string) => el('button', { 'data-action': action, type: 'button' }, text);

  const modeSelect = el('select', { 'data-role': 'mode' });
  for (const [value, text] of MODES) modeSelect.appendChild(Object.assign(el('option', {}, text), { value }));
  const rowSelect = el('select', { 'data-role': 'row-count' });
  for (const n of ROW_COUNT_CHOICES) {
    rowSelect.appendChild(Object.assign(el('option', {}, String(n)), { value: String(n) }));
  }
  const rowInput = el('input', {
    'data-role': 'row-count-input', type: 'number', min: '1', placeholder: '직접 입력',
  });
  const toast = el('div', { 'data-role': 'toast' });
  const diagnostics = el('div', { 'data-role': 'diagnostics' });
  const collectButton = button('collect', '수집');
  const snapshotButton = button('snapshot', '스냅샷');

  const bar = el('div', { class: 'bar' });
  const row = (...children: HTMLElement[]) => {
    const line = el('div', { class: 'row' });
    line.append(...children);
    return line;
  };
  bar.append(
    row(collectButton, snapshotButton),
    modeSelect,
    row(button('year-minus', '−1년'), button('year-plus', '+1년')),
    rowSelect,
    row(rowInput, button('row-count-apply', '적용')),
    toast,
    diagnostics,
  );
  root.append(el('style', {}, STYLE), bar);

  function render(): void {
    const stageMissing = state.screenKnown && !state.screen?.stage;
    collectButton.disabled = state.busy || state.menuNo === null || stageMissing;
    snapshotButton.disabled = state.busy;
    if (state.diag) {
      diagnostics.textContent = formatDiagnostics(state.diag, {
        registeredScreens: state.registeredScreens,
        restored: state.restored,
      });
    }
  }

  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string): void {
    toast.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.textContent = ''), TOAST_MS);
  }

  function noteFailure(reply: Extract<Reply, { ok: false }>): void {
    if (reply.diag) state.diag = reply.diag;
    else if (reply.code === 'offline') state.diag = { ...(state.diag ?? EMPTY_DIAG), core: 'offline' };
    say(formatFailure(reply.code, reply.error));
  }

  async function guarded(work: () => Promise<void>): Promise<void> {
    state.busy = true;
    render();
    try {
      await work();
    } finally {
      state.busy = false;
      render();
    }
  }

  const currentMode = () => modeSelect.value as ExtractMode;

  // 화면을 연달아 바꾸면 늦게 온 옛 화면의 답이 지금 화면을 덮을 수 있어 순번이 맞는 답만 쓴다.
  async function lookUpScreen(menuNo: string): Promise<void> {
    const seq = ++state.lookupSeq;
    const info = await send({ kind: 'screen-info', menuNo });
    if (seq !== state.lookupSeq) return;
    state.screen = info.ok ? info.data : null;
    state.screenKnown = info.ok;
    render();
  }

  async function handleScreenChange(change: ScreenChange): Promise<void> {
    state.menuNo = change.menuNo;
    state.screen = null;
    state.screenKnown = true;
    render();
    const changed = await send({ kind: 'screen.changed', ...change });
    if (changed.ok) {
      if (changed.data.registered) state.registeredScreens++;
    } else {
      noteFailure(changed);
    }
    await lookUpScreen(change.menuNo);
  }

  function closeSnapshot(): void {
    root.querySelector('[data-role="snapshot"]')?.remove();
  }

  function openSnapshot(data: SnapshotData): void {
    closeSnapshot();
    const panel = el('div', { 'data-role': 'snapshot' });
    panel.append(button('close-snapshot', '닫기'), renderSnapshot(doc, data));
    root.appendChild(panel);
  }

  collectButton.addEventListener('click', () => guarded(async () => {
    if (!state.screenKnown && state.menuNo !== null) {
      await lookUpScreen(state.menuNo);
      if (!state.screen?.stage) return say('이 화면은 단계가 정해지지 않아 수집할 수 없음');
    }
    const reply = await send({ kind: 'collect', mode: currentMode() });
    if (!reply.ok) return noteFailure(reply);
    const { result, diag } = reply.data as { result: CaptureReply; diag: Diagnostics };
    state.diag = diag;
    if (result.restored) state.restored++;
    say(formatCaptureResult(result));
  }));

  snapshotButton.addEventListener('click', () => guarded(async () => {
    const reply = await send({ kind: 'snapshot', mode: currentMode() });
    if (!reply.ok) return noteFailure(reply);
    state.diag = reply.data.diag;
    openSnapshot(reply.data);
  }));

  async function shiftYear(delta: -1 | 1): Promise<void> {
    const reply = await send({ kind: 'shift-year', delta });
    if (!reply.ok) return noteFailure(reply);
    const { ok, year, reason } = reply.data as { ok: boolean; year?: number; reason?: string };
    say(ok ? `${year}년 1월 1일 ~ 12월 31일` : (reason ?? '기간을 바꾸지 못함'));
  }
  async function applyRowCount(n: number): Promise<void> {
    const reply = await send({ kind: 'row-count', n });
    if (!reply.ok) return noteFailure(reply);
    const { ok, reason } = reply.data as { ok: boolean; reason?: string };
    say(ok ? `조회건수 ${n}` : (reason ?? '조회건수를 바꾸지 못함'));
  }

  root.querySelector('[data-action="year-minus"]')!.addEventListener('click', () => void shiftYear(-1));
  root.querySelector('[data-action="year-plus"]')!.addEventListener('click', () => void shiftYear(1));
  rowSelect.addEventListener('change', () => void applyRowCount(Number(rowSelect.value)));
  root.querySelector('[data-action="row-count-apply"]')!.addEventListener('click', () => {
    void applyRowCount(Number(rowInput.value));
  });
  root.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).dataset?.action === 'close-snapshot') closeSnapshot();
  });
  render();

  return { root, handleScreenChange };
}

// 확장 안의 화면 탭에서만 붙는다. 시험은 createRemote만 쓴다.
function mountInPage(): void {
  if (window.top !== window) return;
  const send = (message: Record<string, unknown>) =>
    chrome.runtime.sendMessage(message).catch(() => ({
      ok: false as const, code: 'extension', error: '확장 연결이 끊김. 화면을 새로 고치세요.',
    }));
  const remote = createRemote({ doc: document, send });
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source === window && data?.source === 'helper-page' && data.type === 'screen.changed') {
      void remote.handleScreenChange(data.change);
    }
  });
  // page.js가 먼저 떠서 보낸 첫 화면 알림을 놓쳤을 수 있으니 한 번 다시 묻는다.
  window.postMessage({ source: 'helper-remote', type: 'ping' }, '*');
}

if (typeof chrome !== 'undefined' && chrome.runtime?.id && typeof document !== 'undefined') mountInPage();
