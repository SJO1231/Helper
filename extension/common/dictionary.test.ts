import { describe, expect, test } from 'vitest';
import cases from '../../shared/fixtures/dictionary-cases.json';
import type { DictAlias, DictKey, DictLabel, DictScreen } from '../../shared/types';
import {
  countUnknownKeys, isUnregisteredScreen, listUnknownKeys, makeDictionaryView, resolveColumn, resolveLabel,
  resolveStdKey, resolveType,
} from './dictionary';

const aliases = cases.aliases as DictAlias[];
const labels = cases.labels as DictLabel[];
const keys = new Set(cases.stdKeys);

describe('resolveStdKey', () => {
  for (const c of cases.stdKeyCases) {
    test(`stdKey ${c.k}@${c.screen}`, () => {
      expect(resolveStdKey(c.k, c.screen, aliases, keys)).toBe(c.expect);
    });
  }
});

describe('resolveLabel', () => {
  for (const c of cases.labelCases) {
    test(`label ${c.key}@${c.screen}`, () => {
      expect(resolveLabel(c.key, c.screen, c.screenL, labels)).toBe(c.expect);
    });
  }
  test('site label of another site is ignored', () => {
    expect(resolveLabel('keyH', 'S1', 'LS', labels, 'other')).toBe('other-site-H');
  });
});

describe('unknown keys', () => {
  const ks = ['keyB', 'dmZ.nothing', 'dmZ.other', 'dmZ.nothing'];
  test('countUnknownKeys counts only keys with no std key', () => {
    expect(countUnknownKeys(['keyB', 'dmZ.nothing', 'dmZ.other'], 'S1', aliases, keys)).toBe(2);
  });
  test('listUnknownKeys lists each unregistered key once, in order', () => {
    expect(listUnknownKeys(ks, 'S1', aliases, keys)).toEqual(['dmZ.nothing', 'dmZ.other']);
  });
  test('count equals the length of the list', () => {
    expect(countUnknownKeys(ks, 'S1', aliases, keys)).toBe(2);
  });
});

const dictKey = (std_key: string, type: DictKey['type']): DictKey => ({
  std_key, module: 'm', stages: ['bid'], type, label: 'L', as_column: 1, index: 0, derived: 0, display: {},
});
const dictKeys = [dictKey('keyB', 'money'), dictKey('keyD', 'date')];

describe('resolveType and resolveColumn', () => {
  test('type comes from dict_key, text when the key is unregistered', () => {
    expect(resolveType('keyB', dictKeys)).toBe('money');
    expect(resolveType('missing', dictKeys)).toBe('text');
    expect(resolveType(null, dictKeys)).toBe('text');
  });
  const view = makeDictionaryView(aliases, dictKeys, labels);
  test('K goes through alias, label priority and type in one call', () => {
    expect(resolveColumn('dmY.keyB', 'S1', 'LS', view)).toEqual({
      k: 'dmY.keyB', stdKey: 'keyB', label: 'user-B', type: 'money',
    });
  });
  test('unregistered K keeps the screen label, text type and null std key', () => {
    expect(resolveColumn('dmZ.nothing', 'S1', 'LS', view)).toEqual({
      k: 'dmZ.nothing', stdKey: null, label: 'LS', type: 'text',
    });
  });
  test('alias-resolved std key whose dict_key is missing still gets its label but text type', () => {
    expect(resolveColumn('dmX.keyA', 'S1', 'LS', view)).toMatchObject({
      stdKey: 'stdFromScreen', label: 'LS', type: 'text',
    });
  });
});

describe('isUnregisteredScreen', () => {
  const screen = (menu_no: string, site = 'g2b'): DictScreen => ({
    site, menu_no, scrn_no: '', menu_cang_val: '', name: '', stage: null, source_route: '', key_fields: [],
    link: null, options: null,
  });
  const screens = [screen('M1'), screen('M2', 'other')];
  test('true when no dict_screen row has this site and menu_no', () => {
    expect(isUnregisteredScreen('g2b', 'M9', screens)).toBe(true);
    expect(isUnregisteredScreen('g2b', 'M2', screens)).toBe(true);
  });
  test('false when the row exists even if its stage is empty', () => {
    expect(isUnregisteredScreen('g2b', 'M1', screens)).toBe(false);
  });
});
