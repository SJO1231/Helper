import { describe, expect, test } from 'vitest';
import { change, mount, routing, screenRow, settle } from './remote-test-kit';

describe('auto collect', () => {
  const collects = (t: ReturnType<typeof mount>) => t.sent.filter((m) => m.kind === 'collect').length;
  const turnOn = (t: ReturnType<typeof mount>) => {
    t.q('[data-role="auto-collect"]').checked = true;
    t.q('[data-role="auto-collect"]').dispatchEvent(new t.win.Event('change'));
  };
  test('default off, and action.settled does not collect', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    expect(t.q('[data-role="auto-collect"]').checked).toBe(false);
    await t.remote.handleActionSettled();
    expect(collects(t)).toBe(0);
  });
  test('on + stage → one collect with 자동 prefix', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    await t.remote.handleActionSettled();
    expect(collects(t)).toBe(1);
    expect(t.q('[data-role="toast"]').textContent.startsWith('자동 ')).toBe(true);
    expect(t.q('[data-role="diagnostics"]').textContent).toContain('자동수집 1회');
  });
  test('on + no stage → no collect, no toast', async () => {
    const t = mount(routing(null));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    await t.remote.handleActionSettled();
    expect(collects(t)).toBe(0);
    expect(t.q('[data-role="toast"]').textContent).toBe('');
  });
  test('on + busy → skipped', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    const first = t.remote.handleActionSettled();
    await t.remote.handleActionSettled();
    await first;
    expect(collects(t)).toBe(1);
  });
  test('on + core off → silent', async () => {
    const t = mount((m) => (m.kind === 'collect' ? { ok: false, code: 'offline', error: 'x' } : routing('bid')(m)));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    await t.remote.handleActionSettled();
    expect(t.q('[data-role="toast"]').textContent).toBe('');
  });
  const spyPosts = (t: ReturnType<typeof mount>) => {
    const posted: any[] = [];
    t.win.postMessage = (message: unknown) => void posted.push(message);
    return () => posted.filter((m) => m?.type === 'watch-settle').length;
  };
  test('remote 조회 asks MAIN to watch once; a settle after it collects once, none collects nothing', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    const watches = spyPosts(t);
    t.q('[data-action="search"]').click();
    await settle();
    expect(watches()).toBe(1);
    expect(collects(t)).toBe(0); // 로딩이 안 뜨면 settle이 오지 않으니 수집도 없다
    await t.remote.handleActionSettled();
    expect(collects(t)).toBe(1);
  });
  test('조회건수 적용 and 직링크 이동 ask MAIN to watch too', async () => {
    const t = mount(routing('bid', {}));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    const watches = spyPosts(t);
    t.q('[data-action="row-count-apply"]').click();
    await settle();
    expect(watches()).toBe(1);
  });
  test('수집·스냅샷·뷰어 열기·엑셀·연도 buttons never ask MAIN to watch', async () => {
    const t = mount(routing('bid'));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    const watches = spyPosts(t);
    for (const action of ['collect', 'snapshot', 'open-viewer', 'excel', 'year-plus', 'year-minus']) {
      t.q(`[data-action="${action}"]`).click();
      await settle();
    }
    expect(watches()).toBe(0);
  });
  test('switch off → 조회 does not ask MAIN to watch', async () => {
    const t = mount(routing('bid'));
    const watches = spyPosts(t);
    t.q('[data-action="search"]').click();
    await settle();
    expect(watches()).toBe(0);
  });
  test('a failed 조회 does not ask MAIN to watch', async () => {
    const t = mount((m) => (m.kind === 'click-search' ? { ok: true, data: { ok: false, reason: 'x' } } : routing('bid')(m)));
    turnOn(t);
    const watches = spyPosts(t);
    t.q('[data-action="search"]').click();
    await settle();
    expect(watches()).toBe(0);
  });
  test('a rejected capture is not counted and has no 자동 toast', async () => {
    const t = mount(routing('bid', { status: 'rejected', reason: 'R1' }));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    await t.remote.handleActionSettled();
    expect(collects(t)).toBe(1);
    expect(t.q('[data-role="toast"]').textContent).toBe('');
    expect(t.q('[data-role="diagnostics"]').textContent).toContain('자동수집 0회');
  });
  test('settled before screen.changed: the stage is judged on the new screen after its lookup', async () => {
    const stages: Record<string, string | null> = { M1: null, M2: 'bid' };
    const t = mount((m) => (m.kind === 'screen-info' ? { ok: true, data: screenRow(stages[m.menuNo]) } : routing('bid')(m)));
    await t.remote.handleScreenChange(change); // M1은 stage 없음
    turnOn(t);
    await t.remote.handleActionSettled('M2');
    expect(collects(t)).toBe(1);
  });
  test('settled on a screen without stage after the old one had one → no collect', async () => {
    const stages: Record<string, string | null> = { M1: 'bid', M2: null };
    const t = mount((m) => (m.kind === 'screen-info' ? { ok: true, data: screenRow(stages[m.menuNo]) } : routing('bid')(m)));
    await t.remote.handleScreenChange(change);
    turnOn(t);
    await t.remote.handleActionSettled('M2');
    expect(collects(t)).toBe(0);
  });
});
