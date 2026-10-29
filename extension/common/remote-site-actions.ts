import type { Reply } from './background';

export interface SiteActionDeps {
  send: (message: Record<string, unknown>) => Promise<Reply<any>>;
  say: (text: string) => void;
  noteFailure: (reply: Extract<Reply, { ok: false }>) => void;
  watchSettle: () => void;
}

// 화면 버튼을 대신 누르는 동작들은 모두 같은 답 꼴({ok, reason})이다.
export function createSiteActions({ send, say, noteFailure, watchSettle }: SiteActionDeps) {
  async function siteAction(
    message: Record<string, unknown>, done: (data: any) => string, failed: string, startsScreenAction = false,
  ) {
    const reply = await send(message);
    if (!reply.ok) return noteFailure(reply);
    const data = reply.data as { ok: boolean; reason?: string };
    say(data.ok ? done(data) : (data.reason ?? failed));
    // 조회처럼 화면이 일하게 만드는 동작만 자동수집 대상이다(엑셀·연도는 아니다).
    if (data.ok && startsScreenAction) watchSettle();
  }
  return {
    shiftYear: (delta: -1 | 1) => siteAction(
      { kind: 'shift-year', delta }, (d) => `${d.year}년 1월 1일 ~ 12월 31일`, '기간을 바꾸지 못함'),
    search: () => siteAction({ kind: 'click-search' }, () => '조회를 눌렀음', '조회를 누르지 못함', true),
    clickExcel: () => siteAction({ kind: 'click-excel' }, () => '엑셀을 눌렀음', '엑셀을 누르지 못함'),
    applyRowCount: (n: number) => siteAction(
      { kind: 'row-count', n }, () => `조회건수 ${n}`, '조회건수를 바꾸지 못함', true),
  };
}
