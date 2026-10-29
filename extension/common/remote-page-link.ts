import type { ScreenChange } from './screen-watch';

// MAIN world(page.js)가 postMessage로 보내는 알림을 리모컨에 이어 준다.
interface PageListener {
  handleScreenChange(change: ScreenChange): Promise<void>;
  handleActionSettled(menuNo: string | null): Promise<void>;
  announceAutoCollect(): void;
}

export function listenToPage(win: Window, remote: PageListener): void {
  win.addEventListener('message', (event) => {
    const data = event.data;
    if (event.source !== win || data?.source !== 'helper-page') return;
    if (data.type === 'screen.changed') {
      void remote.handleScreenChange(data.change);
      remote.announceAutoCollect(); // page.js가 늦게 떴어도 스위치 값을 받게 한다
    }
    if (data.type === 'action.settled') {
      void remote.handleActionSettled(typeof data.menuNo === 'string' ? data.menuNo : null);
    }
  });
  // page.js가 먼저 떠서 보낸 첫 화면 알림을 놓쳤을 수 있으니 한 번 다시 묻는다.
  win.postMessage({ source: 'helper-remote', type: 'ping' }, '*');
}
