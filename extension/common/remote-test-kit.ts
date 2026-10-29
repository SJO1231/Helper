import { Window } from 'happy-dom';
import type { Diagnostics } from '../../shared/types';
import { createRemote } from './remote';

export const diag: Diagnostics = {
  forms: 3, grids: 1, droppedEmptyRef: 5, droppedSameDataList: 1, failedGrids: 0,
  droppedParam: 2, unknownKeys: 4, core: 'ok',
};
export const raw = {
  state: {},
  param: {},
  pointInfo: [{ k: 'dmA.keyA', v: 'V0', l: 'L0', visible: true }],
  tables: [{
    id: 'g', dataList: 'dl', visible: true,
    columns: [{ k: 'colA', l: 'LA' }, { k: 'colB', l: 'LB' }, { k: 'colC', l: 'LC' }],
    rows: [{ colA: 'V1', colB: 'V2', colC: 'V3' }],
  }],
};
export const labels = { colA: 'L-user', colB: 'L-screen', colC: 'L1', 'dmA.keyA': 'L-form' };
export const screenRow = (stage: string | null) => ({ site: 'g2b', menu_no: 'M1', stage, key_fields: ['k1'] });

export type Handler = (m: any) => unknown;
export function mount(handler: Handler = () => ({ ok: true, data: null })) {
  const win = new Window({ url: 'https://example.invalid/' }) as any;
  const sent: any[] = [];
  const send = async (m: any) => {
    sent.push(m);
    return handler(m) as any;
  };
  win.confirm = () => {
    throw new Error('confirm must not be used');
  };
  const remote = createRemote({ doc: win.document, send });
  const q = (selector: string) => remote.root.querySelector(selector) as any;
  return { win, sent, remote, q };
}
export const change = { menuNo: 'M1', scrnNo: 'S1', menuCangVal: 'C1', menuNm: 'N1' };
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export function routing(stage: string | null, extra: Record<string, unknown> = {}): Handler {
  return (m) => {
    if (m.kind === 'screen.changed') return { ok: true, data: { registered: true } };
    if (m.kind === 'screen-info') return { ok: true, data: screenRow(stage) };
    if (m.kind === 'snapshot') return { ok: true, data: { raw, diag, labels } };
    if (m.kind === 'collect') {
      const result = { status: 'changed', record_id: 'R', stage: 'bid', changed: ['a', 'b', 'c'], unknown_keys: 4 };
      return { ok: true, data: { result: { ...result, ...extra }, diag } };
    }
    return { ok: true, data: { ok: true, year: 2025 } };
  };
}
