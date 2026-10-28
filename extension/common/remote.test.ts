import { Window } from 'happy-dom';
import { describe, expect, test } from 'vitest';
import type { Diagnostics } from '../../shared/types';
import { formatCaptureResult, formatDiagnostics } from './diagnostics';
import { createRemote } from './remote';
import { renderSnapshot } from './snapshot-view';

const diag: Diagnostics = {
  forms: 3, grids: 1, droppedEmptyRef: 5, droppedSameDataList: 1, failedGrids: 0,
  droppedParam: 2, unknownKeys: 4, core: 'ok',
};
const raw = {
  state: {},
  param: {},
  pointInfo: [{ k: 'dmA.keyA', v: 'V0', l: 'L0', visible: true }],
  tables: [{
    id: 'g', dataList: 'dl', visible: true,
    columns: [{ k: 'colA', l: 'LA' }, { k: 'colB', l: 'LB' }, { k: 'colC', l: 'LC' }],
    rows: [{ colA: 'V1', colB: 'V2', colC: 'V3' }],
  }],
};
const labels = { colA: 'L-user', colB: 'L-screen', colC: 'L1', 'dmA.keyA': 'L-form' };
const screenRow = (stage: string | null) => ({ site: 'g2b', menu_no: 'M1', stage, key_fields: ['k1'] });

type Handler = (m: any) => unknown;
function mount(handler: Handler = () => ({ ok: true, data: null })) {
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
const change = { menuNo: 'M1', scrnNo: 'S1', menuCangVal: 'C1', menuNm: 'N1' };
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function routing(stage: string | null, extra: Record<string, unknown> = {}): Handler {
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

describe('remote controls', () => {
  test('collect button disabled when screen has no stage', async () => {
    const t = mount(routing(null));
    await t.remote.handleScreenChange(change);
    expect(t.q('[data-action="collect"]').disabled).toBe(true);
  });
  test('collect button enabled when the screen has a stage', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    expect(t.q('[data-action="collect"]').disabled).toBe(false);
  });
  test('collect starts disabled before any screen is known', () => {
    expect(mount().q('[data-action="collect"]').disabled).toBe(true);
  });
  test('mode select defaults to visible and offers three modes', () => {
    const select = mount().q('[data-role="mode"]');
    expect(select.value).toBe('visible');
    expect(Array.from(select.options).map((o: any) => o.textContent)).toEqual(['보이는 것만', '숨김 포함', '전체']);
  });
  test('the chosen mode goes with snapshot and collect', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    t.q('[data-role="mode"]').value = 'hidden';
    t.q('[data-action="snapshot"]').click();
    await settle();
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.sent.filter((m) => m.kind === 'snapshot' || m.kind === 'collect').map((m) => m.mode))
      .toEqual(['hidden', 'hidden']);
  });
  test('the remote comes back when the page clears its body', async () => {
    const t = mount(routing('bid'));
    t.win.document.body.innerHTML = '<div id="page-content"></div>';
    await settle();
    const host = t.win.document.getElementById('helper-remote');
    expect(host).not.toBeNull();
    expect(host.shadowRoot).toBe(t.remote.root);
  });
  test('viewer button asks the background to open the viewer', async () => {
    const t = mount(routing(null));
    expect(t.q('[data-action="open-viewer"]').textContent).toBe('뷰어');
    t.q('[data-action="open-viewer"]').click();
    await settle();
    expect(t.sent.map((m) => m.kind)).toEqual(['open-viewer']);
  });
  test('year buttons send -1 and +1', async () => {
    const t = mount(routing('bid'));
    t.q('[data-action="year-minus"]').click();
    t.q('[data-action="year-plus"]').click();
    await settle();
    expect(t.sent.map((m) => [m.kind, m.delta])).toEqual([['shift-year', -1], ['shift-year', 1]]);
  });
  test('search button sends click-search and reports a missing button', async () => {
    const missing = { ok: true, data: { ok: false, reason: '못 찾음' } };
    const t = mount((m) => (m.kind === 'click-search' ? missing : { ok: true, data: null }));
    t.q('[data-action="search"]').click();
    await settle();
    expect(t.sent.map((m) => m.kind)).toEqual(['click-search']);
    expect(t.q('[data-role="toast"]').textContent).toBe('못 찾음');
  });
  test('excel button sits next to search, sends click-excel and reports the result', async () => {
    const reply = (data: object) => (m: any) => ({ ok: true, data: m.kind === 'click-excel' ? data : null });
    const missing = mount(reply({ ok: false, reason: '못 찾음' }));
    const search = missing.q('[data-action="search"]');
    expect(search.nextElementSibling).toBe(missing.q('[data-action="excel"]'));
    missing.q('[data-action="excel"]').click();
    await settle();
    expect(missing.sent.map((m) => m.kind)).toEqual(['click-excel']);
    expect(missing.q('[data-role="toast"]').textContent).toBe('못 찾음');
    const found = mount(reply({ ok: true }));
    found.q('[data-action="excel"]').click();
    await settle();
    expect(found.q('[data-role="toast"]').textContent).toBe('엑셀을 눌렀음');
  });
  test('row count select and typed value both send row-count', async () => {
    const t = mount(routing('bid'));
    const select = t.q('[data-role="row-count"]');
    const values = Array.from(select.options).map((o: any) => o.value);
    expect(values).toEqual(['10', '30', '50', '100', '250', '500', '1000']);
    select.value = '100';
    select.dispatchEvent(new t.win.Event('change'));
    t.q('[data-role="row-count-input"]').value = '75';
    t.q('[data-action="row-count-apply"]').click();
    await settle();
    expect(t.sent.map((m) => [m.kind, m.n])).toEqual([['row-count', 100], ['row-count', 75]]);
  });
});

describe('screen lookup when the core was off', () => {
  test('collect stays enabled after a failed lookup and asks again on click', async () => {
    let coreUp = false;
    const t = mount((m) => {
      if (m.kind === 'screen-info') {
        return coreUp ? { ok: true, data: screenRow('bid') } : { ok: false, code: 'offline', error: '코어 꺼짐' };
      }
      return routing('bid')(m);
    });
    await t.remote.handleScreenChange(change);
    expect(t.q('[data-action="collect"]').disabled).toBe(false);
    coreUp = true;
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.sent.filter((m) => m.kind === 'collect')).toHaveLength(1);
    expect(t.sent.filter((m) => m.kind === 'screen-info')).toHaveLength(2);
  });
  test('after a retry that finds no stage nothing is collected', async () => {
    let up = false;
    const t = mount((m) => {
      if (m.kind !== 'screen-info') return routing('bid')(m);
      return up ? { ok: true, data: screenRow(null) } : { ok: false, code: 'offline', error: 'x' };
      return routing('bid')(m);
    });
    await t.remote.handleScreenChange(change);
    up = true;
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.sent.filter((m) => m.kind === 'collect')).toHaveLength(0);
    expect(t.q('[data-action="collect"]').disabled).toBe(true);
  });
  test('a late lookup for an old screen does not overwrite the current one', async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    const t = mount((m) => {
      if (m.kind === 'screen-info') return new Promise((resolve) => void (pending[m.menuNo] = resolve));
      return { ok: true, data: { registered: false } };
    });
    const first = t.remote.handleScreenChange({ ...change, menuNo: 'OLD' });
    const second = t.remote.handleScreenChange({ ...change, menuNo: 'NEW' });
    await settle();
    pending.NEW({ ok: true, data: screenRow('bid') });
    await second;
    pending.OLD({ ok: true, data: screenRow(null) });
    await first;
    expect(t.q('[data-action="collect"]').disabled).toBe(false);
  });
});

describe('snapshot view', () => {
  test('snapshot table headers are resolved labels', async () => {
    const view = renderSnapshot(new Window().document as any, { raw, diag, labels });
    const grid = view.querySelector('table[data-kind="grid"]')!;
    const ths = Array.from(grid.querySelectorAll('th')).map((th) => th.textContent);
    expect(ths).toEqual(['L-user', 'L-screen', 'L1']);
  });
  test('rows show the raw text and the form is a label-headed table too', () => {
    const view = renderSnapshot(new Window().document as any, { raw, diag, labels });
    const cells = Array.from(view.querySelectorAll('table[data-kind="grid"] td')).map((td) => td.textContent);
    expect(cells).toEqual(['V1', 'V2', 'V3']);
    const form = view.querySelector('table[data-kind="form"]')!;
    expect(Array.from(form.querySelectorAll('th')).map((th) => th.textContent)).toEqual(['L-form']);
    expect(form.querySelector('td')!.textContent).toBe('V0');
  });
  test('the view has no inputs or editable cells', () => {
    const view = renderSnapshot(new Window().document as any, { raw, diag, labels });
    expect(view.querySelector('input, textarea, select, [contenteditable]')).toBeNull();
  });
  test('opening a snapshot sends no write request and shows the table', async () => {
    const t = mount(routing('bid'));
    t.q('[data-action="snapshot"]').click();
    await settle();
    expect(t.sent.map((m) => m.kind)).toEqual(['snapshot']);
    expect(t.q('[data-role="snapshot"] table[data-kind="grid"]')).not.toBeNull();
    expect(t.q('[data-role="diagnostics"]').textContent).toMatch(/빈 ref 제외 5/);
  });
  test('closing the snapshot window removes it', async () => {
    const t = mount(routing('bid'));
    t.q('[data-action="snapshot"]').click();
    await settle();
    t.q('[data-action="close-snapshot"]').click();
    expect(t.q('[data-role="snapshot"]')).toBeNull();
  });
});

describe('diagnostics', () => {
  test('diagnostics line shows empty-ref and unknown-key counts as numbers', () => {
    const line = formatDiagnostics(diag);
    expect(line).toMatch(/빈 ref 제외 \d+/);
    expect(line).toMatch(/미등록 키 \d+/);
    expect(line).toMatch(/새로 등록한 화면 \d+/);
    expect(line).toMatch(/되살림 \d+건/);
  });
  test('offline shows 코어 꺼짐', () => {
    expect(formatDiagnostics({ ...diag, core: 'offline' })).toContain('코어 꺼짐');
    expect(formatDiagnostics(diag)).not.toContain('코어 꺼짐');
  });
  test('extra counters appear in the line', () => {
    expect(formatDiagnostics(diag, { registeredScreens: 2, restored: 3 })).toMatch(/새로 등록한 화면 2.*되살림 3건/);
  });
  test('changed result reads 바뀐 칸 n개', () => {
    const result = {
      status: 'changed', record_id: 'R', stage: 'bid', changed: ['a', 'b', 'c'], unknown_keys: 0,
    } as const;
    expect(formatCaptureResult({ ...result, changed: [...result.changed] })).toBe('바뀐 칸 3개');
  });
  test('rejected result carries its reason', () => {
    const result = {
      status: 'rejected', record_id: null, stage: null, changed: [], unknown_keys: 0, reason: 'R1',
    } as const;
    expect(formatCaptureResult({ ...result, changed: [] })).toContain('R1');
  });
});

describe('collect results in the remote', () => {
  test('changed result shows the 바뀐 칸 toast without a confirm dialog', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.q('[data-role="toast"]').textContent).toBe('바뀐 칸 3개');
  });
  test('restored results add to the 되살림 count in the line', async () => {
    const t = mount(routing('bid', { restored: true }));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.q('[data-role="diagnostics"]').textContent).toMatch(/되살림 1건/);
    expect(t.q('[data-role="toast"]').textContent).toContain('되살림');
  });
  test('a newly registered screen is counted in the line', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    t.q('[data-action="snapshot"]').click();
    await settle();
    expect(t.q('[data-role="diagnostics"]').textContent).toMatch(/새로 등록한 화면 1/);
  });
  test('offline core shows 코어 꺼짐', async () => {
    const t = mount((m) => {
      if (m.kind !== 'collect') return routing('bid')(m);
      return { ok: false, code: 'offline', error: '코어 꺼짐', diag: { ...diag, core: 'offline' } };
    });
    await t.remote.handleScreenChange(change);
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.q('[data-role="diagnostics"]').textContent).toContain('코어 꺼짐');
  });
  test('a failed page read shows its reason, not a stale result', async () => {
    const t = mount((m) => {
      if (m.kind !== 'collect') return routing('bid')(m);
      return { ok: false, code: 'loading', error: 'loading' };
    });
    await t.remote.handleScreenChange(change);
    t.q('[data-action="collect"]').click();
    await settle();
    expect(t.q('[data-role="toast"]').textContent).toContain('불러오는 중');
  });
});
