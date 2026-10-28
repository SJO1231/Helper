import { describe, expect, test } from 'vitest';
import fixture from '../fixtures/capture-minimal.json';
import { validate, validateSeedFile } from '../schema/validate';

const screen = {
  site: 'g2b', menu_no: 'M0001', scrn_no: 'S0001', menu_cang_val: '', name: 'N1',
  stage: 'bid', source_route: '', key_fields: ['keyA'], link: null, options: null,
};
const keyRow = {
  std_key: 'keyA', module: 'm', stages: ['bid'], type: 'text', label: 'L1', as_column: 1, index: 0, derived: 0,
  display: { source: ['data_map'] },
};
const omit = (o: Record<string, unknown>, k: string) => Object.fromEntries(Object.entries(o).filter(([n]) => n !== k));

describe('capture-request', () => {
  test('capture-minimal fixture passes capture-request schema', () => {
    expect(validate('capture-request', fixture)).toBe(true);
  });
  test('capture without raw fails', () => {
    expect(validate('capture-request', omit(fixture, 'raw'))).toBe(false);
  });
  test('mode outside visible|hidden|all fails', () => {
    expect(validate('capture-request', { ...fixture, mode: 'skip' })).toBe(false);
  });
  test('extra top-level field fails but extra raw field is kept open', () => {
    expect(validate('capture-request', { ...fixture, extra: 1 })).toBe(false);
    expect(validate('capture-request', { ...fixture, raw: { ...fixture.raw, extra: 1 } })).toBe(true);
  });
  test('pointInfo value must be a string, not a number', () => {
    const raw = { ...fixture.raw, pointInfo: [{ k: 'a', v: 0, l: '', visible: true }] };
    expect(validate('capture-request', { ...fixture, raw })).toBe(false);
  });
});

describe('capture-result', () => {
  const ok = { status: 'new', record_id: 'A|1', stage: 'bid', changed: [], unknown_keys: 0 };
  test('capture-result rejects unknown status', () => {
    expect(validate('capture-result', { ...ok, status: 'inserted' })).toBe(false);
  });
  test('capture-result accepts the four statuses', () => {
    for (const status of ['same', 'new', 'changed']) expect(validate('capture-result', { ...ok, status })).toBe(true);
  });
  test('rejected needs a reason and may have null record_id and stage', () => {
    const rejected = { status: 'rejected', record_id: null, stage: null, changed: [], unknown_keys: 0 };
    expect(validate('capture-result', rejected)).toBe(false);
    expect(validate('capture-result', { ...rejected, reason: 'R1' })).toBe(true);
  });
});

describe('records-page', () => {
  test('records-page needs records and total', () => {
    expect(validate('records-page', { records: [{ id: 'A|1', fields: {} }], total: 1 })).toBe(true);
    expect(validate('records-page', { records: [] })).toBe(false);
  });
  test('record id may be a number but a record needs fields', () => {
    expect(validate('records-page', { records: [{ id: 7, fields: {} }], total: 1 })).toBe(true);
    expect(validate('records-page', { records: [{ id: 7 }], total: 1 })).toBe(false);
  });
});

describe('dict-screen', () => {
  test('dict-screen with a stage needs 1 or 2 key_fields; without stage may be empty', () => {
    expect(validate('dict-screen', { ...screen, stage: null, key_fields: [] })).toBe(true);
    expect(validate('dict-screen', { ...screen, stage: 'bid', key_fields: [] })).toBe(false);
    expect(validate('dict-screen', { ...screen, key_fields: ['a', 'b', 'c'] })).toBe(false);
  });
  test('stage outside receipt|bid|contract fails', () => {
    expect(validate('dict-screen', { ...screen, stage: 'notice' })).toBe(false);
  });
});

describe('native-message', () => {
  test('hello request, hello response, request and response each pass', () => {
    expect(validate('native-message', { type: 'hello' })).toBe(true);
    expect(validate('native-message', { port: 8765, token: 'T', schema_version: 1 })).toBe(true);
    const request = { type: 'request', method: 'GET', path: '/api/tables', headers: {}, body: null };
    expect(validate('native-message', request)).toBe(true);
    expect(validate('native-message', { status: 200, body: {} })).toBe(true);
  });
  test('hello response without token fails', () => {
    expect(validate('native-message', { port: 8765, schema_version: 1 })).toBe(false);
  });
});

describe('seed files', () => {
  test('dict_key rows pass and need display.source', () => {
    expect(validateSeedFile('dict_key', { rows: [keyRow] })).toBe(true);
    expect(validateSeedFile('dict_key', { rows: [{ ...keyRow, display: {} }] })).toBe(false);
  });
  test('seed row with an unknown field fails', () => {
    expect(validateSeedFile('dict_key', { rows: [{ ...keyRow, extra: 1 }] })).toBe(false);
  });
  test('file without rows fails', () => {
    expect(validateSeedFile('dict_key', {})).toBe(false);
  });
  test('the other five seed files accept their row shape', () => {
    const alias = { site: 'g2b', screen_code: null, source_key: 'dmA.keyA', std_key: 'keyA' };
    const label = { scope: 'system', scope_id: '', key: 'keyA', label: 'L1' };
    const code = { std_key: 'keyA', code: '00', meaning: 'M1', scope: '' };
    const child = { site: 'g2b', table_code: 'dlA', alias: 'item', stage: 'bid', typed: 0, key_fields: [] };
    expect(validateSeedFile('dict_alias', { rows: [alias] })).toBe(true);
    expect(validateSeedFile('dict_label', { rows: [label] })).toBe(true);
    expect(validateSeedFile('dict_code', { rows: [code] })).toBe(true);
    expect(validateSeedFile('dict_child', { rows: [child] })).toBe(true);
    expect(validateSeedFile('dict_screen', { rows: [screen] })).toBe(true);
  });
  test('dict_label with a scope outside user|screen|site|system fails', () => {
    const label = { scope: 'team', scope_id: '', key: 'keyA', label: 'L1' };
    expect(validateSeedFile('dict_label', { rows: [label] })).toBe(false);
  });
  test('dict_screen rows keep the stage and key_fields rule', () => {
    expect(validateSeedFile('dict_screen', { rows: [{ ...screen, key_fields: [] }] })).toBe(false);
  });
});
