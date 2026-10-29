import { installScreenWatch } from '../../common/screen-watch';
import { installActionWatch } from './action-watch';
import { collectScreen } from './collect';
import { readScreenState } from './identify';
import { openMenu } from './open-menu';
import { applyRowCount, clickExcel, clickSearch, shiftYear } from './remote-actions';
import type { ExtractMode } from '../../../shared/types';

// MAIN world 진입점. background가 executeScript로 window.__helper의 함수를 부르고,
// 화면 이동은 postMessage로 isolated world의 리모컨에 알린다(MAIN은 chrome.runtime을 못 쓴다).
(window as any).__helper = {
  collect: (mode: ExtractMode) => collectScreen(window, mode),
  shiftYear: (delta: -1 | 1) => shiftYear(window, delta),
  clickSearch: () => clickSearch(window),
  clickExcel: () => clickExcel(window),
  applyRowCount: (n: number) => applyRowCount(window, n),
  openMenu: (menuCangVal: string) => openMenu(window, menuCangVal),
};

const watch = installScreenWatch(window, readScreenState, (change) => {
  window.postMessage({ source: 'helper-page', type: 'screen.changed', change }, '*');
});

// 사용자가 버튼을 눌러 로딩이 끝나면 알린다. 켜기·끄기는 리모컨이 보낸다(기본 꺼짐).
const actions = installActionWatch(window, () => {
  window.postMessage({ source: 'helper-page', type: 'action.settled' }, '*');
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (event.source !== window || data?.source !== 'helper-remote') return;
  if (data.type === 'ping') watch.announce();
  if (data.type === 'auto-collect') actions.setEnabled(data.on === true);
});
