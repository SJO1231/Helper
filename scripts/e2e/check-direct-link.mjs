// 직링크: 13713(발주계획·사전규격 목록)에서 리모컨 select로 01175를 골라 이동한다.
import { BID_LIST, ORDER_LIST, countRegistered, openList } from './check-screen-register.mjs';
import { readMenuNo } from './page-reads.mjs';
import { chooseScreen, pressRemote } from './remote-ui.mjs';

const WATCH_MS = 3000;

export async function checkDirectLink(s, core) {
  await openList(s, core, ORDER_LIST);
  const rowsBefore = await core.total('dict_screen', { site: ['g2b'] });
  const registered = await countRegistered(core, BID_LIST);
  const listed = await chooseScreen(s, BID_LIST.menuNo);
  if (!listed) return { pass: false, 이유: 'select에 01175가 없음', 등록행수: registered };
  await pressRemote(s, 'open-screen');
  await s.page.waitForTimeout(WATCH_MS);
  const menuNo = await s.page.evaluate(readMenuNo);
  // 이동 뒤 자동 등록(screen.changed)이 끝날 시간을 더 준다.
  await s.page.waitForTimeout(1500);
  const rowsAfter = await core.total('dict_screen', { site: ['g2b'] });
  return {
    pass: registered === 1 && menuNo === BID_LIST.menuNo && rowsAfter === rowsBefore,
    이동_뒤_화면코드_맞음: menuNo === BID_LIST.menuNo, 이동_전_01175_행수: registered, 전체행수_전: rowsBefore,
    전체행수_후: rowsAfter,
  };
}
