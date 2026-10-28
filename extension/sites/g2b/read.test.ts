import { describe, expect, test } from 'vitest';
import { inBody, isVisible } from './body';
import { readForm, findLabel } from './form';
import { readGrids } from './grids';
import { flattenParam } from './param';
import { makeWindow } from './test-fixtures';

const everything = () => true;

describe('readForm', () => {
  test('K strips data: prefix and keeps dataMap', () => {
    const win = makeWindow({ forms: [{ id: 'a', ref: 'dmA.keyA', value: 'RAW' }] });
    expect(readForm(win, everything).fields[0].k).toBe('dmA.keyA');
  });
  test('V uses getValue, not input.value', () => {
    const win = makeWindow({ forms: [{ id: 'a', ref: 'dmA.keyA', value: 'RAW' }] });
    expect(readForm(win, everything).fields[0].v).toBe('RAW');
  });
  test('values become text: 0, false, 00 survive and null is empty', () => {
    const win = makeWindow({
      forms: [
        { id: 'a', ref: 'd.a', value: 0 },
        { id: 'b', ref: 'd.b', value: false },
        { id: 'c', ref: 'd.c', value: '00' },
        { id: 'd', ref: 'd.d', value: null },
      ],
    });
    expect(readForm(win, everything).fields.map((f) => f.v)).toEqual(['0', 'false', '00', '']);
  });
  test('empty ref components are dropped and counted', () => {
    const win = makeWindow({
      forms: [{ id: 'a', ref: 'd.a', value: 'V' }, { id: 'b', value: 'V' }, { id: 'c', ref: '', value: 'V' }],
    });
    const r = readForm(win, everything);
    expect(r.fields.map((f) => f.k)).toEqual(['d.a']);
    expect(r.droppedEmptyRef).toBe(2);
  });
  test('visible flag follows getClientRects', () => {
    const win = makeWindow({
      forms: [{ id: 'a', ref: 'd.a', value: 'V', visible: false }, { id: 'b', ref: 'd.b', value: 'V' }],
    });
    expect(readForm(win, everything).fields.map((f) => f.visible)).toEqual([false, true]);
  });
  test('field label comes from findLabel', () => {
    const html = '<label for="a">L-for</label><input id="a">';
    const win = makeWindow({ forms: [{ id: 'a', ref: 'd.a', value: 'V', html }] });
    expect(readForm(win, everything).fields[0].l).toBe('L-for');
  });
});

describe('findLabel', () => {
  const label = (html: string, attrs?: Record<string, string>) => {
    const win = makeWindow({ forms: [{ id: 'x', ref: 'd.x', value: 'V', html, attrs }] });
    return findLabel(win.document.getElementById('x')!);
  };
  test('label[for] comes first', () => {
    const html = '<label for="x">L-for</label><table><tr><th>L-th</th><td><input id="x"></td></tr></table>';
    expect(label(html, { title: 'L-title' })).toBe('L-for');
  });
  test('previous cell th comes before the row th', () => {
    const html = '<table><tr><th>L-first</th><td>c</td><th>L-prev</th><td><input id="x"></td></tr></table>';
    expect(label(html)).toBe('L-prev');
  });
  test('row th when the previous cell is not a th', () => {
    const html = '<table><tr><th>L-row</th><td>c</td><td><input id="x"></td></tr></table>';
    expect(label(html)).toBe('L-row');
  });
  test('title attribute is the last resort and none gives empty', () => {
    expect(label('<input id="x">', { title: 'L-title' })).toBe('L-title');
    expect(label('<input id="x">')).toBe('');
  });
});

describe('body', () => {
  test('element with wq_uuid id inside the container counts as body', () => {
    const win = makeWindow({ grids: [{ id: 'wq_uuid_7_grdFile', dataList: 'dl' }] });
    expect(inBody(win.document.getElementById('wq_uuid_7_grdFile')!, win.document)).toBe(true);
  });
  test('element outside the container is not body', () => {
    const win = makeWindow({ forms: [{ id: 'o', ref: 'd.o', value: 'V', outside: true }] });
    expect(inBody(win.document.getElementById('o')!, win.document)).toBe(false);
  });
  test('isVisible reads getClientRects', () => {
    const win = makeWindow({ forms: [{ id: 'h', visible: false }, { id: 's' }] });
    expect(isVisible(win.document.getElementById('h')!)).toBe(false);
    expect(isVisible(win.document.getElementById('s')!)).toBe(true);
  });
});

describe('readGrids', () => {
  const cols = [{ id: 'colA', label: 'L1' }, { id: 'colB', label: 'L2' }];
  test('grids sharing a dataList keep the visible one', () => {
    const win = makeWindow({
      grids: [
        { id: 'gridHidden', dataList: 'dl', visible: false, columns: cols },
        { id: 'gridVisible', dataList: 'dl', columns: cols },
      ],
    });
    const t = readGrids(win, everything);
    expect(t.tables.map((x) => x.id)).toEqual(['gridVisible']);
    expect(t.droppedSameDataList).toBe(1);
  });
  test('both hidden with same dataList keep document-first', () => {
    const win = makeWindow({
      grids: [
        { id: 'first', dataList: 'dl', visible: false, columns: cols },
        { id: 'second', dataList: 'dl', visible: false, columns: cols },
      ],
    });
    expect(readGrids(win, everything).tables.map((x) => x.id)).toEqual(['first']);
  });
  test('grid whose getAllJSON throws is skipped and counted', () => {
    const win = makeWindow({
      grids: [{ id: 'bad', dataList: 'dlBad', throws: true }, { id: 'ok', dataList: 'dlOk', columns: cols }],
    });
    const t = readGrids(win, everything);
    expect(t.failedGrids).toBe(1);
    expect(t.tables.map((x) => x.id)).toEqual(['ok']);
  });
  test('grid labels come from getHeaderID then getHeaderValue', () => {
    const win = makeWindow({ grids: [{ id: 'g', dataList: 'dl', columns: cols }] });
    const t = readGrids(win, everything).tables[0];
    expect(t.columns).toEqual([{ k: 'colA', l: 'L1' }, { k: 'colB', l: 'L2' }]);
    expect(t.dataList).toBe('dl');
  });
  test('row values become text: 0, false, 00 survive', () => {
    const win = makeWindow({
      grids: [{ id: 'g', dataList: 'dl', columns: cols, rows: [{ a: 0, b: false, c: '00', d: null }] }],
    });
    expect(readGrids(win, everything).tables[0].rows[0]).toEqual({ a: '0', b: 'false', c: '00', d: '' });
  });
  test('filter keeps out grids the mode does not read', () => {
    const win = makeWindow({ grids: [{ id: 'out', dataList: 'dl', outside: true, columns: cols }] });
    const inBodyOnly = (el: Element) => inBody(el, win.document);
    expect(readGrids(win, inBodyOnly).tables).toEqual([]);
  });
});

describe('flattenParam', () => {
  test('param flattens one level and drops deeper', () => {
    const p = flattenParam({ k1: 'V', obj: { k2: 'V', deep: { x: 1 } }, list: [1, 2] });
    expect(p.param).toEqual({ 'param.k1': 'V', 'param.obj.k2': 'V' });
    expect(p.dropped).toBe(2);
  });
  test('non-object param gives nothing', () => {
    expect(flattenParam(undefined)).toEqual({ param: {}, dropped: 0 });
  });
  test('scalars keep original text', () => {
    const p = flattenParam({ a: 0, b: false, c: null }).param;
    expect(p).toEqual({ 'param.a': '0', 'param.b': 'false', 'param.c': '' });
  });
});
