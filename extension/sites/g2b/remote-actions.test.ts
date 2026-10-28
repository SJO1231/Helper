import { describe, expect, test } from 'vitest';
import { ROW_COUNT_CHOICES, applyRowCount, clickExcel, clickSearch, shiftYear } from './remote-actions';
import { makeWindow } from './test-fixtures';
import type { FakeWindow } from './test-fixtures';

type Call = (string | number)[];

function setup(bodyHtml: string, hidden: string[] = []) {
  const win = makeWindow();
  win.document.getElementById('mf_wfm_container')!.innerHTML = bodyHtml;
  for (const el of Array.from(win.document.querySelectorAll('[id]'))) {
    (el as any).getClientRects = () => (hidden.includes(el.id) ? [] : [{}]);
  }
  return win;
}

function calendar(win: FakeWindow, id: string, value: string, plugin = 'inputCalendar') {
  const state = { value };
  win[id] = {
    getPluginName: () => plugin,
    getValue: () => state.value,
    setValue: (v: string) => {
      state.value = v;
    },
  };
  return state;
}

const PAIR = '<table><tr><td><input id="start"></td><td><input id="end"></td></tr></table>';

describe('shiftYear', () => {
  test('-1 year sets both to Jan 1 and Dec 31 of start year - 1', () => {
    const win = setup(PAIR);
    const start = calendar(win, 'start', '20260315');
    const end = calendar(win, 'end', '20260630');
    expect(shiftYear(win, -1)).toEqual({ ok: true, year: 2025 });
    expect(start.value).toBe('20250101');
    expect(end.value).toBe('20251231');
  });
  test('+1 year uses start year + 1', () => {
    const win = setup(PAIR);
    const start = calendar(win, 'start', '20260315');
    const end = calendar(win, 'end', '20260630');
    expect(shiftYear(win, 1).year).toBe(2027);
    expect([start.value, end.value]).toEqual(['20270101', '20271231']);
  });
  test('hidden calendars are skipped', () => {
    const html = '<input id="h1"><input id="h2">' + PAIR;
    const win = setup(html, ['h1', 'h2']);
    calendar(win, 'h1', '19990101');
    calendar(win, 'h2', '19991231');
    const start = calendar(win, 'start', '20260315');
    calendar(win, 'end', '20260630');
    shiftYear(win, -1);
    expect(start.value).toBe('20250101');
  });
  test('a pair in one table row wins over document-order neighbours', () => {
    const html = '<input id="lone">' + PAIR;
    const win = setup(html);
    const lone = calendar(win, 'lone', '20300101');
    calendar(win, 'start', '20260315');
    calendar(win, 'end', '20260630');
    shiftYear(win, -1);
    expect(lone.value).toBe('20300101');
  });
  test('falls back to two neighbours in document order', () => {
    const win = setup('<input id="a"><input id="b">');
    const a = calendar(win, 'a', '20260315');
    const b = calendar(win, 'b', '20260630');
    expect(shiftYear(win, -1).ok).toBe(true);
    expect([a.value, b.value]).toEqual(['20250101', '20251231']);
  });
  test('search button is not triggered', () => {
    const win = setup(PAIR + '<button id="search">go</button>');
    calendar(win, 'start', '20260315');
    calendar(win, 'end', '20260630');
    let searchClicks = 0;
    win.document.getElementById('search')!.addEventListener('click', () => searchClicks++);
    shiftYear(win, -1);
    expect(searchClicks).toBe(0);
  });
  test('no visible pair returns ok false with reason', () => {
    const win = setup('<input id="only">');
    calendar(win, 'only', '20260315');
    const r = shiftYear(win, -1);
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
  test('real screens use input components that hold a YYYYMMDD value', () => {
    const win = setup(PAIR);
    const start = calendar(win, 'start', '20260315', 'input');
    const end = calendar(win, 'end', '20260630', 'input');
    expect(shiftYear(win, 1)).toEqual({ ok: true, year: 2027 });
    expect([start.value, end.value]).toEqual(['20270101', '20271231']);
  });
  test('input components without a date value are not taken as the period', () => {
    const win = setup('<input id="a"><input id="b">' + PAIR);
    calendar(win, 'a', 'free text', 'input');
    calendar(win, 'b', '12345', 'input');
    const start = calendar(win, 'start', '20260315', 'input');
    calendar(win, 'end', '20260630', 'input');
    expect(shiftYear(win, -1).year).toBe(2025);
    expect(start.value).toBe('20250101');
  });
  test('start value without a year returns ok false', () => {
    const win = setup(PAIR);
    calendar(win, 'start', '');
    calendar(win, 'end', '');
    expect(shiftYear(win, -1).ok).toBe(false);
  });
});

function rowCountWindow(options: number[], withPager = true) {
  const html = '<div id="grid"></div><select id="size">' +
    options.map((n) => `<option value="${n}">${n}</option>`).join('') + '</select><div id="pager"></div>';
  const win = setup(html);
  const calls: Call[] = [];
  win.grid = { getPluginName: () => 'gridView' };
  // 실제 선택 상자는 글자 값만 받는다. 숫자를 넘기면 값이 바뀌지 않는다.
  win.size = {
    getPluginName: () => 'selectbox',
    setValue: (v: unknown) => calls.push(['setValue', v as string]),
    addItem: (v: unknown, label: unknown) => calls.push(['addItem', v as string, label as string]),
  };
  if (withPager) {
    win.pager = {
      getPluginName: () => 'pageList',
      setPageSize: (n: number) => calls.push(['setPageSize', n]),
    };
  }
  return { win, calls };
}

describe('applyRowCount', () => {
  test('choices are the seven listed sizes', () => {
    expect(ROW_COUNT_CHOICES).toEqual([10, 30, 50, 100, 250, 500, 1000]);
  });
  test('row count already listed only sets the value as text, then the page size', () => {
    const { win, calls } = rowCountWindow([10, 30, 50, 100]);
    expect(applyRowCount(win, 100)).toEqual({ ok: true });
    expect(calls).toEqual([['setValue', '100'], ['setPageSize', 100]]);
  });
  test('row count 250 adds option, addItem, then setValue, then the page size', () => {
    const { win, calls } = rowCountWindow([10, 30, 50, 100]);
    expect(applyRowCount(win, 250).ok).toBe(true);
    expect(calls).toEqual([['addItem', '250', '250'], ['setValue', '250'], ['setPageSize', 250]]);
    const values = Array.from(win.document.querySelectorAll('#size option')).map((o) => (o as any).value);
    expect(values).toContain('250');
  });
  test('a screen without a visible page list still gets the select value', () => {
    const { win, calls } = rowCountWindow([10, 100], false);
    expect(applyRowCount(win, 100).ok).toBe(true);
    expect(calls).toEqual([['setValue', '100']]);
  });
  test('no visible grid returns ok false', () => {
    const win = setup('<select id="size"><option value="10">10</option></select>');
    expect(applyRowCount(win, 10).ok).toBe(false);
  });
  test('rejects sizes that are not positive integers', () => {
    const { win, calls } = rowCountWindow([10]);
    expect(applyRowCount(win, 0).ok).toBe(false);
    expect(applyRowCount(win, 1.5).ok).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe('clickSearch', () => {
  function watchClicks(win: FakeWindow, id: string) {
    const clicks: string[] = [];
    win.document.getElementById(id)!.addEventListener('click', () => clicks.push(id));
    return clicks;
  }
  test('clicks the visible button whose text is 조회', () => {
    const win = setup('<button id="b1">조회</button><button id="b2">저장</button>');
    const clicks = watchClicks(win, 'b1');
    expect(clickSearch(win)).toEqual({ ok: true });
    expect(clicks).toEqual(['b1']);
  });
  test('accepts an input button by value and a 검색 label', () => {
    const win = setup('<input id="b1" type="button" value="검색">');
    const clicks = watchClicks(win, 'b1');
    expect(clickSearch(win).ok).toBe(true);
    expect(clicks).toEqual(['b1']);
  });
  test('skips hidden buttons', () => {
    const win = setup('<button id="hid">조회</button><button id="shown">검색</button>', ['hid']);
    const hidden = watchClicks(win, 'hid');
    const shown = watchClicks(win, 'shown');
    clickSearch(win);
    expect(hidden).toEqual([]);
    expect(shown).toEqual(['shown']);
  });
  test('ignores buttons outside the body', () => {
    const win = setup('');
    win.document.body.insertAdjacentHTML('beforeend', '<button id="out">조회</button>');
    (win.document.getElementById('out') as any).getClientRects = () => [{}];
    expect(clickSearch(win).ok).toBe(false);
  });
  test('clicks the wrapping button when only an inner span has the text', () => {
    const win = setup('<a id="a1"><span id="s1">조회</span></a>');
    const clicks = watchClicks(win, 'a1');
    clickSearch(win);
    expect(clicks).toEqual(['a1']);
  });
  test('without a button, presses Enter in the first visible input', () => {
    const win = setup('<input id="hid"><input id="in1"><input id="in2">', ['hid']);
    const keys: string[] = [];
    for (const id of ['hid', 'in1', 'in2']) {
      win.document.getElementById(id)!.addEventListener('keydown', (e: any) => keys.push(`${id}:${e.key}`));
    }
    expect(clickSearch(win)).toEqual({ ok: true });
    expect(keys).toEqual(['in1:Enter']);
  });
  test('no button and no input returns ok false with a reason', () => {
    const result = clickSearch(setup('<div id="d">내용</div>'));
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
});

describe('clickExcel', () => {
  function watch(win: FakeWindow, ...ids: string[]) {
    const clicks: string[] = [];
    for (const id of ids) win.document.getElementById(id)!.addEventListener('click', () => clicks.push(id));
    return clicks;
  }
  test('clicks a visible button whose text has 엑셀', () => {
    const win = setup('<button id="b1">엑셀다운로드</button><button id="b2">저장</button>');
    const clicks = watch(win, 'b1', 'b2');
    expect(clickExcel(win)).toEqual({ ok: true });
    expect(clicks).toEqual(['b1']);
  });
  test('matches excel in any case on an input button value', () => {
    const win = setup('<input id="b1" type="button" value="Excel Down">');
    const clicks = watch(win, 'b1');
    expect(clickExcel(win).ok).toBe(true);
    expect(clicks).toEqual(['b1']);
  });
  test('finds a link and an image button by alt or title', () => {
    const link = setup('<a id="a1" href="#">엑셀저장</a>');
    const linkClicks = watch(link, 'a1');
    clickExcel(link);
    expect(linkClicks).toEqual(['a1']);
    const image = setup('<input id="i1" type="image" alt="엑셀"><img id="i2" title="다운로드">');
    const imageClicks = watch(image, 'i1', 'i2');
    clickExcel(image);
    expect(imageClicks).toEqual(['i1']);
  });
  test('clicks the wrapping link when only an inner span has the text', () => {
    const win = setup('<a id="a1"><span id="s1">엑셀</span></a>');
    const clicks = watch(win, 'a1', 's1');
    clickExcel(win);
    expect(clicks).toEqual(['a1']);
  });
  test('prefers 엑셀 over a plain 다운로드 even when 다운로드 comes first', () => {
    const win = setup('<button id="d1">다운로드</button><button id="e1">엑셀</button>');
    const clicks = watch(win, 'd1', 'e1');
    clickExcel(win);
    expect(clicks).toEqual(['e1']);
  });
  test('falls back to 다운로드 when no excel button exists', () => {
    const win = setup('<button id="d1">다운로드</button>');
    const clicks = watch(win, 'd1');
    expect(clickExcel(win).ok).toBe(true);
    expect(clicks).toEqual(['d1']);
  });
  test('skips hidden buttons and anything outside the body', () => {
    const win = setup('<button id="hid">엑셀</button>', ['hid']);
    win.document.body.insertAdjacentHTML('beforeend', '<button id="out">엑셀</button>');
    (win.document.getElementById('out') as any).getClientRects = () => [{}];
    const result = clickExcel(win);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });
  test('no matching button returns ok false', () => {
    expect(clickExcel(setup('<button id="b1">조회</button>')).ok).toBe(false);
  });
});
