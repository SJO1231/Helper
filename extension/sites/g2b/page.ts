import { installScreenWatch } from '../../common/screen-watch';
import { collectScreen } from './collect';
import { readScreenState } from './identify';
import { applyRowCount, clickSearch, shiftYear } from './remote-actions';
import type { ExtractMode } from '../../../shared/types';

// MAIN world 진입점. background가 executeScript로 window.__helper의 함수를 부르고,
// 화면 이동은 postMessage로 isolated world의 리모컨에 알린다(MAIN은 chrome.runtime을 못 쓴다).
(window as any).__helper = {
  collect: (mode: ExtractMode) => collectScreen(window, mode),
  shiftYear: (delta: -1 | 1) => shiftYear(window, delta),
  clickSearch: () => clickSearch(window),
  applyRowCount: (n: number) => applyRowCount(window, n),
};

const watch = installScreenWatch(window, readScreenState, (change) => {
  window.postMessage({ source: 'helper-page', type: 'screen.changed', change }, '*');
});

window.addEventListener('message', (event) => {
  const data = event.data;
  if (event.source === window && data?.source === 'helper-remote' && data.type === 'ping') watch.announce();
});
