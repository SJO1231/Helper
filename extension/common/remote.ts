/// <reference types="chrome" />
import type { CaptureResult, Diagnostics, DictScreen, ExtractMode } from '../../shared/types';
import type { ScreenChange } from './screen-watch';
import { ROW_COUNT_CHOICES } from '../sites/g2b/remote-actions';
import type { Reply } from './background';
import {
  AUTO_TOAST_PREFIX, announceAutoCollect, createAutoCollectToggle, requestSettleWatch, shouldAutoCollect,
} from './auto-collect';
import { createDirectLink } from './direct-link';
import { formatCaptureResult, formatDiagnostics, formatFailure } from './diagnostics';
import { attachPanelMotion, chromePanelStore } from './remote-panel';
import type { PanelStore } from './remote-panel';
import { STYLE } from './remote-style';
import { listenToPage } from './remote-page-link';
import { createSiteActions } from './remote-site-actions';
import { renderSnapshot } from './snapshot-view';
import type { SnapshotData } from './snapshot-view';

export interface RemoteDeps {
  doc: Document;
  send: (message: Record<string, unknown>) => Promise<Reply<any>>;
  panelStore?: PanelStore;
}

const MODES: [ExtractMode, string][] = [['visible', '보이는 것만'], ['hidden', '숨김 포함'], ['all', '전체']];
const TOAST_MS = 4000;
const EMPTY_DIAG: Diagnostics = {
  forms: 0, grids: 0, droppedEmptyRef: 0, droppedSameDataList: 0, failedGrids: 0,
  droppedParam: 0, unknownKeys: 0, core: 'ok',
};

export function createRemote(deps: RemoteDeps) {
  const { doc, send, panelStore } = deps;
  const state = {
    screen: null as DictScreen | null,
    menuNo: null as string | null,
    screenKnown: false, // 화면 사전 조회가 성공했는지. 코어가 꺼져 있었다면 false라 수집을 눌러 다시 묻는다
    lookupSeq: 0,
    diag: null as Diagnostics | null,
    registeredScreens: 0,
    restored: 0,
    screenListTruncated: false,
    autoCollected: 0,
    busy: false,
  };
  const host = doc.createElement('div');
  host.id = 'helper-remote';
  doc.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  // 나라장터는 처음 뜬 뒤 body를 비우고 다시 그린다. 같은 host를 다시 붙여 상태와 버튼을 잃지 않는다.
  const Observer = doc.defaultView!.MutationObserver;
  let motion: ReturnType<typeof attachPanelMotion> | undefined;
  new Observer(() => {
    if (host.isConnected || !doc.body || motion?.isClosed()) return;
    doc.body.appendChild(host);
    motion?.reapply();
  }).observe(doc.documentElement, { childList: true, subtree: true });

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
  const autoToggle = createAutoCollectToggle(doc);

  // 자동수집이 켜져 있을 때만 MAIN world에 알린다(MAIN도 꺼져 있으면 무시한다).
  const watchSettle = () => {
    if (autoToggle.box.checked) requestSettleWatch(doc.defaultView);
  };
  const directLink = createDirectLink({
    doc, send, say, noteFailure, currentMenuNo: () => state.menuNo, onNavigated: watchSettle,
    onTruncated: (truncated) => {
      state.screenListTruncated = truncated;
      render();
    },
  });

  const bar = el('div', { class: 'bar' });
  const row = (...children: HTMLElement[]) => {
    const line = el('div', { class: 'row' });
    line.append(...children);
    return line;
  };
  const title = el('div', { class: 'title' });
  const collapseButton = button('collapse', '—');
  collapseButton.title = '접기';
  const closeButton = button('close', '×');
  closeButton.title = '종료 (Alt+G로 다시 열기)';
  const actions = el('div', { class: 'actions' });
  actions.append(collapseButton, closeButton);
  title.append(el('span', {}, 'Helper'), actions);
  const bubble = el('button', { class: 'bubble', type: 'button', title: '펼치기' }, 'G2B');
  const coreStatus = el('div', { 'data-role': 'core-status' });
  const TABS: [string, string][] = [['work', '업무'], ['collect', '수집'], ['viewer', '뷰어']];
  const tabButtons = TABS.map(([name, text]) => el('button', { 'data-tab': name, role: 'tab', type: 'button' }, text));
  const tabBar = el('div', { class: 'tabs', role: 'tablist' });
  tabBar.append(...tabButtons);
  const pane = (name: string, ...children: HTMLElement[]) => {
    const node = el('div', { class: 'pane', 'data-pane': name });
    node.append(...children);
    return node;
  };
  const panes = [
    pane('work',
      row(button('year-minus', '−1년'), button('year-plus', '+1년'), button('search', '조회'), button('excel', '엑셀')),
      row(rowSelect, rowInput, button('row-count-apply', '적용')),
      row(directLink.select, directLink.goButton)),
    pane('collect', modeSelect, row(collectButton, snapshotButton), row(autoToggle.label)),
    pane('viewer', button('open-viewer', '뷰어 열기'), coreStatus),
  ];
  bar.append(title, tabBar, ...panes, toast, diagnostics);
  root.append(el('style', {}, STYLE), bar, bubble);
  motion = attachPanelMotion({
    doc, bar, bubble, handle: title, collapseButton, closeButton, host,
    tabs: { buttons: tabButtons, panes }, store: panelStore,
    autoCollect: { box: autoToggle.box, onChange: (on) => announceAutoCollect(doc.defaultView, on) },
  });

  function render(): void {
    const stageMissing = state.screenKnown && !state.screen?.stage;
    collectButton.disabled = state.busy || state.menuNo === null || stageMissing;
    snapshotButton.disabled = state.busy;
    coreStatus.textContent = !state.diag ? '코어 상태 미확인' : state.diag.core === 'ok' ? '코어 연결' : '코어 꺼짐';
    const parts = [state.diag && formatDiagnostics(state.diag, {
      registeredScreens: state.registeredScreens,
      restored: state.restored,
      autoCollected: state.autoCollected,
    })];
    if (state.screenListTruncated) parts.push('직링크 목록 잘림');
    diagnostics.textContent = parts.filter(Boolean).join(' · ');
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
  async function lookUpScreen(menuNo: string): Promise<Reply> {
    const seq = ++state.lookupSeq;
    const info = await send({ kind: 'screen-info', menuNo });
    if (seq !== state.lookupSeq) return info;
    state.screen = info.ok ? info.data : null;
    state.screenKnown = info.ok;
    render();
    return info;
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
    await Promise.all([lookUpScreen(change.menuNo), directLink.refresh()]);
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

  // 자동일 때는 실패와 거절을 조용히 넘기고, 저장 결과 토스트에만 접두어를 붙인다.
  async function collectOnce(auto: boolean): Promise<void> {
    if (!state.screenKnown && state.menuNo !== null) {
      const info = await lookUpScreen(state.menuNo);
      if (!info.ok) return auto ? undefined : noteFailure(info);
      if (!state.screen?.stage) return auto ? undefined : say('이 화면은 단계가 정해지지 않아 수집할 수 없음');
    }
    const reply = await send({ kind: 'collect', mode: currentMode() });
    if (!reply.ok) return auto ? undefined : noteFailure(reply);
    const { result, diag } = reply.data as { result: CaptureResult; diag: Diagnostics };
    state.diag = diag;
    if (auto && result.status === 'rejected') return; // 코어가 거절한 수집은 한 일이 아니다
    if (result.restored) state.restored++;
    if (auto) state.autoCollected++;
    say((auto ? AUTO_TOAST_PREFIX : '') + formatCaptureResult(result));
  }

  collectButton.addEventListener('click', () => guarded(() => collectOnce(false)));

  // MAIN world가 버튼 동작(사용자·리모컨)이 끝났다고 알리면 1회 수집한다.
  // 화면이 바뀐 동작이면 screen.changed보다 먼저 올 수 있어, 알림에 실린 menuNo로 화면 사전을 다시 읽은 뒤 판정한다.
  async function handleActionSettled(currentMenuNo?: string | null): Promise<void> {
    if (!autoToggle.box.checked) return;
    if (currentMenuNo) {
      if (currentMenuNo !== state.menuNo) {
        state.menuNo = currentMenuNo;
        state.screen = null;
      }
      await lookUpScreen(currentMenuNo);
    }
    const ready = shouldAutoCollect({
      on: autoToggle.box.checked, busy: state.busy, menuNo: state.menuNo,
      screenKnown: state.screenKnown, stage: state.screen?.stage,
    });
    if (ready) await guarded(() => collectOnce(true));
  }

  snapshotButton.addEventListener('click', () => guarded(async () => {
    const reply = await send({ kind: 'snapshot', mode: currentMode() });
    if (!reply.ok) return noteFailure(reply);
    state.diag = reply.data.diag;
    openSnapshot(reply.data);
  }));

  const { shiftYear, search, clickExcel, applyRowCount } = createSiteActions({ send, say, noteFailure, watchSettle });
  root.querySelector('[data-action="open-viewer"]')!.addEventListener('click', async () => {
    const reply = await send({ kind: 'open-viewer' });
    if (!reply.ok) noteFailure(reply);
  });
  root.querySelector('[data-action="year-minus"]')!.addEventListener('click', () => void shiftYear(-1));
  root.querySelector('[data-action="year-plus"]')!.addEventListener('click', () => void shiftYear(1));
  root.querySelector('[data-action="search"]')!.addEventListener('click', () => void search());
  root.querySelector('[data-action="excel"]')!.addEventListener('click', () => void clickExcel());
  rowSelect.addEventListener('change', () => void applyRowCount(Number(rowSelect.value)));
  root.querySelector('[data-action="row-count-apply"]')!.addEventListener('click', () => {
    void applyRowCount(Number(rowInput.value));
  });
  async function promoteKey(target: HTMLElement): Promise<void> {
    const { k, l, source } = target.dataset;
    const reply = await send({ kind: 'promote-key', k, l, source, menuNo: state.menuNo });
    if (!reply.ok) return noteFailure(reply);
    target.replaceWith('올림');
    if (state.diag) state.diag = { ...state.diag, unknownKeys: Math.max(0, state.diag.unknownKeys - 1) };
  }

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.dataset?.action === 'close-snapshot') closeSnapshot();
    if (target.dataset?.action === 'promote-key') void guarded(() => promoteKey(target));
  });
  render();

  return {
    root, handleScreenChange, handleActionSettled, refreshScreenList: directLink.refresh,
    announceAutoCollect: () => announceAutoCollect(doc.defaultView, autoToggle.box.checked),
  };
}

// 확장 안의 화면 탭에서만 붙는다. 시험은 createRemote만 쓴다.
function mountInPage(): void {
  if (window.top !== window) return;
  const send = (message: Record<string, unknown>) =>
    chrome.runtime.sendMessage(message).catch(() => ({
      ok: false as const, code: 'extension', error: '확장 연결이 끊김. 화면을 새로 고치세요.',
    }));
  const remote = createRemote({ doc: document, send, panelStore: chromePanelStore() });
  void remote.refreshScreenList();
  listenToPage(window, remote);
}

if (typeof chrome !== 'undefined' && chrome.runtime?.id && typeof document !== 'undefined') mountInPage();
