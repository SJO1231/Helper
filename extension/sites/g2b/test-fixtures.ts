import { Window as HappyWindow } from 'happy-dom';

// 가짜 WebSquare 창. 값은 모두 자리표시이고 구조만 실제 화면을 흉내 낸다.
export interface FormSpec {
  id: string;
  ref?: string;
  value?: unknown;
  visible?: boolean;
  outside?: boolean;
  html?: string; // 요소 자리에 넣을 HTML. 비우면 <input id>
  attrs?: Record<string, string>;
}
export interface GridSpec {
  id: string;
  dataList: string;
  visible?: boolean;
  outside?: boolean;
  columns?: { id: string; label: string }[];
  rows?: Record<string, unknown>[];
  throws?: boolean;
}
export interface WindowSpec {
  forms?: FormSpec[];
  grids?: GridSpec[];
  state?: Record<string, unknown> | null;
  processBarVisible?: boolean;
  frames?: FakeWindow[];
  withWebSquare?: boolean;
}

export type FakeWindow = globalThis.Window & Record<string, any>;

function placeElement(win: FakeWindow, parent: Element, id: string, html: string, visible: boolean): void {
  parent.insertAdjacentHTML('beforeend', html);
  const el = win.document.getElementById(id)!;
  (el as any).getClientRects = () => (visible ? [{}] : []);
}

function makeGridComponent(spec: GridSpec): Record<string, any> {
  const columns = spec.columns ?? [];
  return {
    id: spec.id,
    options: { dataList: spec.dataList },
    getPluginName: () => 'gridView',
    getColumnCount: () => columns.length,
    getColumnID: (i: number) => columns[i].id,
    getTotalHeaderCol: () => columns.length,
    getHeaderID: (i: number) => `h${i}`,
    getColIdByHeaderId: (h: string) => columns[Number(h.slice(1))].id,
    getHeaderValue: (h: string) => columns[Number(h.slice(1))].label,
    getAllJSON: () => {
      if (spec.throws) throw new Error('unbound dataList');
      return spec.rows ?? [];
    },
  };
}

export function makeWindow(spec: WindowSpec = {}): FakeWindow {
  const win = new HappyWindow({ url: 'https://example.invalid/' }) as unknown as FakeWindow;
  win.document.body.innerHTML = '<div id="mf_wfm_container"></div><div id="outside"></div>';
  const body = win.document.getElementById('mf_wfm_container')!;
  const outside = win.document.getElementById('outside')!;
  if (spec.withWebSquare !== false) win.$p = {};
  Object.defineProperty(win, 'frames', { value: spec.frames ?? [], configurable: true });

  for (const f of spec.forms ?? []) {
    const parent = f.outside ? outside : body;
    placeElement(win, parent, f.id, f.html ?? `<input id="${f.id}">`, f.visible ?? true);
    const el = win.document.getElementById(f.id)!;
    for (const [name, value] of Object.entries(f.attrs ?? {})) el.setAttribute(name, value);
    (el as any).value = 'FORMATTED';
    win[f.id] = {
      getPluginName: () => 'input',
      getRef: f.ref === undefined ? undefined : () => `data:${f.ref}`,
      getValue: () => f.value,
    };
  }
  for (const g of spec.grids ?? []) {
    placeElement(win, g.outside ? outside : body, g.id, `<div id="${g.id}"></div>`, g.visible ?? true);
    win[g.id] = makeGridComponent(g);
  }
  if (spec.state !== undefined) {
    setState(win, spec.state);
  }
  if (spec.processBarVisible !== undefined) {
    const html = '<div id="__processbarIFrame"></div>';
    placeElement(win, win.document.body, '__processbarIFrame', html, spec.processBarVisible);
  }
  return win;
}

// happy-dom의 history·frames는 읽기 전용이라 defineProperty로 바꾼다.
export function setState(win: FakeWindow, data: Record<string, unknown> | null): void {
  const history = { state: data === null ? null : { data } };
  Object.defineProperty(win, 'history', { value: history, configurable: true });
}
