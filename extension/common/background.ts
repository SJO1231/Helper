/// <reference types="chrome" />
import { CoreError, CoreOfflineError } from '../../shared/core-client';
import type { CoreClient } from '../../shared/core-client';
import type {
  CaptureResult, ConnectionInfo, DictAlias, DictKey, DictLabel, DictScreen, Diagnostics, ExtractMode, RawCapture,
} from '../../shared/types';
import { createConnection } from './connection';
import type { Connection } from './connection';
import { createNativeClient } from './host';
import { listUnknownKeys, makeDictionaryView, resolveColumn } from './dictionary';
import { promoteKey, unknownKeyList } from './promote-key';

const SITE = 'g2b';
const DICT_LIMIT = 5000;
const SCREEN_LIST_LIMIT = 500;

export type CaptureReply = CaptureResult & { restored?: boolean };
export type Reply<T = unknown> =
  | { ok: true; data: T; truncated?: boolean }
  | { ok: false; error: string; code: string; diag?: Diagnostics };
export interface Sender { tab?: { id?: number; url?: string }; url?: string }
export type PageOutcome = { ok: true; data: unknown } | { ok: false; error: string };
export type PageRunner = (tabId: number, method: string, args: unknown[]) => Promise<PageOutcome>;

interface CollectedScreen {
  raw: RawCapture;
  diag: Diagnostics;
  screen: { menuNo: string; scrnNo: string; menuNm: string };
}
type Message = { kind: string } & Record<string, any>;

const PAGE_ERROR_CODES = ['loading', 'no-screen', 'screen-changed'];
const failure = (code: string, error: string, diag?: Diagnostics): Reply => ({ ok: false, code, error, diag });

function coreFailure(error: unknown, diag?: Diagnostics): Reply {
  if (error instanceof CoreOfflineError) {
    return failure('offline', '코어 꺼짐', diag && { ...diag, core: 'offline' });
  }
  const message = error instanceof CoreError ? error.message : String(error);
  return failure('core', message, diag);
}

const asList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = typeof value === 'string' && value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

// 코어는 stage가 없으면 빈 글자를 줄 수 있다. 화면 쪽은 null 하나로만 본다.
function normalizeScreen(fields: Record<string, unknown>): DictScreen {
  return { ...fields, stage: fields.stage || null, key_fields: asList(fields.key_fields) } as DictScreen;
}

async function loadDictionary(core: CoreClient) {
  const all = async (table: string) => {
    const page = await core.getRecords(table, { limit: DICT_LIMIT });
    return page.records.map((r) => r.fields);
  };
  const [aliases, keys, labels] = await Promise.all([all('dict_alias'), all('dict_key'), all('dict_label')]);
  return makeDictionaryView(
    aliases as unknown as DictAlias[],
    keys as unknown as DictKey[],
    labels as unknown as DictLabel[],
  );
}

function allKeys(raw: RawCapture): string[] {
  const formKeys = raw.pointInfo.map((f) => f.k);
  const columnKeys = raw.tables.flatMap((t) => t.columns.map((c) => c.k));
  return [...formKeys, ...columnKeys, ...Object.keys(raw.param)];
}

function screenLabels(raw: RawCapture, menuNo: string, view: ReturnType<typeof makeDictionaryView>) {
  const labels: Record<string, string> = {};
  const add = (k: string, l: string) => {
    if (!(k in labels)) labels[k] = resolveColumn(k, menuNo, l, view).label;
  };
  for (const f of raw.pointInfo) add(f.k, f.l);
  for (const t of raw.tables) for (const c of t.columns) add(c.k, c.l);
  return labels;
}

function fallbackLabels(raw: RawCapture): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const f of raw.pointInfo) labels[f.k] ??= f.l;
  for (const t of raw.tables) for (const c of t.columns) labels[c.k] ??= c.l;
  return labels;
}

export interface BackgroundDeps {
  connection: Connection;
  runInPage: PageRunner;
  extensionOrigin: string;
  openViewer: (table: string) => Promise<void>;
}

export function createHandlers(deps: BackgroundDeps) {
  const { connection, runInPage } = deps;

  async function inPage<T>(tabId: number, method: string, args: unknown[]): Promise<T> {
    const outcome = await runInPage(tabId, method, args);
    if (!outcome.ok) throw new Error(outcome.error);
    return outcome.data as T;
  }

  async function snapshot(tabId: number, mode: ExtractMode): Promise<Reply> {
    const { raw, diag, screen } = await inPage<CollectedScreen>(tabId, 'collect', [mode]);
    try {
      return await connection.withCore(async (core) => {
        const view = await loadDictionary(core);
        const unknown = listUnknownKeys(allKeys(raw), screen.menuNo, view.aliases, view.stdKeys);
        const labels = screenLabels(raw, screen.menuNo, view);
        const data = { raw, diag: { ...diag, unknownKeys: unknown.length }, labels };
        return { ok: true as const, data: { ...data, unknownKeyList: unknownKeyList(raw, unknown) } };
      });
    } catch (error) {
      if (!(error instanceof CoreOfflineError)) throw error;
      // 코어가 꺼져도 화면의 라벨로 표는 보여 준다.
      const offline: Diagnostics = { ...diag, core: 'offline' };
      return { ok: true, data: { raw, diag: offline, labels: fallbackLabels(raw) } };
    }
  }

  async function collect(tabId: number, tabUrl: string, mode: ExtractMode): Promise<Reply> {
    const { raw, diag, screen } = await inPage<CollectedScreen>(tabId, 'collect', [mode]);
    const fields = { site: SITE, menu_no: screen.menuNo, scrn_no: screen.scrnNo, url: tabUrl, mode, raw } as const;
    try {
      const result = await connection.withCore((core) => core.postCapture({ ...fields }));
      return { ok: true, data: { result, diag: { ...diag, unknownKeys: result.unknown_keys } } };
    } catch (error) {
      return coreFailure(error, diag);
    }
  }

  async function screenInfo(menuNo: string): Promise<Reply> {
    return connection.withCore(async (core) => {
      const page = await core.getRecords('dict_screen', { filter: { site: [SITE], menu_no: [menuNo] }, limit: 1 });
      const row = page.records[0]?.fields;
      return { ok: true as const, data: row ? normalizeScreen(row) : null };
    });
  }

  // 사람이 버튼을 눌렀을 때만 온다. 코어가 이름을 거절하면 그 이유가 그대로 올라간다.
  async function promote(m: Message): Promise<Reply> {
    return connection.withCore(async (core) => {
      const filter = { site: [SITE], menu_no: [String(m.menuNo)] };
      const page = await core.getRecords('dict_screen', { filter, limit: 1 });
      const stage = page.records[0] ? normalizeScreen(page.records[0].fields).stage : null;
      const source = m.source === undefined ? undefined : String(m.source);
      const stdKey = await promoteKey(core, String(m.k), String(m.l), stage, source);
      return { ok: true as const, data: { stdKey } };
    });
  }

  // 직링크 목록의 유일한 출처는 dict_screen 행이다.
  async function screenList(): Promise<Reply> {
    return connection.withCore(async (core) => {
      const query = { filter: { site: [SITE] }, sort: 'name', limit: SCREEN_LIST_LIMIT };
      const page = await core.getRecords('dict_screen', query);
      const data = page.records.map(({ fields }) => ({
        menu_no: String(fields.menu_no ?? ''),
        menu_cang_val: String(fields.menu_cang_val ?? ''),
        name: String(fields.name ?? ''),
      }));
      // 목록이 한도를 넘으면 잘렸다고 알려, 직링크에 없는 화면이 있음을 리모컨이 보이게 한다.
      const truncated = page.total > SCREEN_LIST_LIMIT;
      return truncated ? { ok: true as const, data, truncated } : { ok: true as const, data };
    });
  }

  async function openScreen(tabId: number, menuNo: string): Promise<Reply> {
    const found = await connection.withCore((core) =>
      core.getRecords('dict_screen', { filter: { site: [SITE], menu_no: [menuNo] }, limit: 1 }));
    const menuCangVal = String(found.records[0]?.fields.menu_cang_val ?? '');
    if (!found.records[0]) return { ok: true, data: { ok: false, reason: '사전에 없는 화면' } };
    if (!menuCangVal) return { ok: true, data: { ok: false, reason: '이 화면은 이동 코드가 없음' } };
    return { ok: true, data: await inPage(tabId, 'openMenu', [menuCangVal]) };
  }

  // 실패해도 쌓아 두지 않는다. 다음 화면 이동 때 새로 시도할 뿐이다.
  async function registerScreen(m: Message): Promise<Reply> {
    return connection.withCore(async (core) => {
      const known = await core.getRecords('dict_screen', { filter: { site: [SITE], menu_no: [m.menuNo] }, limit: 1 });
      await core.putRecords(
        'dict_screen',
        [{
          require: { site: SITE, menu_no: m.menuNo },
          fields: { scrn_no: m.scrnNo, menu_cang_val: m.menuCangVal, name: m.menuNm },
        }],
        { noupdate: true },
      );
      return { ok: true as const, data: { registered: known.total === 0 } };
    });
  }

  async function route(message: Message, sender: Sender): Promise<Reply> {
    if (message.kind === 'core.connection') {
      if (!sender.url?.startsWith(deps.extensionOrigin)) return failure('forbidden', '확장 페이지만 부를 수 있음');
      return { ok: true, data: await connection.getConnection() satisfies ConnectionInfo };
    }
    const tabId = sender.tab?.id;
    if (tabId === undefined) return failure('forbidden', '화면 탭에서 온 요청만 받음');
    switch (message.kind) {
      case 'snapshot': return snapshot(tabId, message.mode);
      case 'collect': return collect(tabId, sender.tab?.url ?? '', message.mode);
      case 'screen-info': return screenInfo(String(message.menuNo));
      case 'screen-list': return screenList();
      case 'open-screen': return openScreen(tabId, String(message.menuNo));
      case 'screen.changed': return registerScreen(message);
      case 'promote-key': return promote(message);
      case 'shift-year': return { ok: true, data: await inPage(tabId, 'shiftYear', [message.delta]) };
      case 'click-search': return { ok: true, data: await inPage(tabId, 'clickSearch', []) };
      case 'click-excel': return { ok: true, data: await inPage(tabId, 'clickExcel', []) };
      case 'row-count': return { ok: true, data: await inPage(tabId, 'applyRowCount', [message.n]) };
      case 'open-viewer': return { ok: true, data: await deps.openViewer(String(message.table ?? '')) };
      default: return failure('unknown', `알 수 없는 요청: ${message.kind}`);
    }
  }

  async function handle(message: Message, sender: Sender): Promise<Reply> {
    try {
      return await route(message, sender);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (PAGE_ERROR_CODES.includes(text)) return failure(text, text);
      return coreFailure(error);
    }
  }

  return { handle };
}

// 서비스 워커로 뜰 때만 chrome에 붙는다. 시험은 createHandlers만 쓴다.
// 페이지 쪽 함수는 직렬화되어 가므로 바깥 변수를 쓰지 않는다.
async function runInPageWithChrome(tabId: number, method: string, args: unknown[]): Promise<PageOutcome> {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [method, args],
    func: async (name: string, params: unknown[]) => {
      try {
        const helper = (window as any).__helper;
        if (!helper) return { ok: false, error: 'not-ready' };
        return { ok: true, data: await helper[name](...params) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
  });
  return (injection?.result ?? { ok: false, error: 'no-result' }) as PageOutcome;
}

const SESSION_KEY = 'connection';

function startWorker(): void {
  const store = {
    async get() {
      const saved = await chrome.storage.session.get(SESSION_KEY);
      return (saved[SESSION_KEY] as ConnectionInfo | undefined) ?? null;
    },
    async set(info: ConnectionInfo | null) {
      if (info) await chrome.storage.session.set({ [SESSION_KEY]: info });
      else await chrome.storage.session.remove(SESSION_KEY);
    },
  };
  const connection = createConnection({ host: createNativeClient(chrome.runtime), store });
  const { handle } = createHandlers({
    connection,
    runInPage: runInPageWithChrome,
    extensionOrigin: `chrome-extension://${chrome.runtime.id}/`,
    async openViewer(table: string) {
      const query = table ? `?table=${encodeURIComponent(table)}` : '';
      await chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html${query}`) });
    },
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handle(message, sender).then(sendResponse);
    return true;
  });
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) startWorker();
