import { isLoading, waitUntilLoaded } from './loading';

export interface ActionWatchOptions { graceMs?: number; pollMs?: number; loadedIntervalMs?: number }

const BUTTON_LIKE = 'button,a,input[type="button"],input[type="submit"],[role="button"]';
const REMOTE_HOST = '#helper-remote';

// 클릭 뒤 graceMs 안에 로딩 표시가 뜨는지만 짧게 본다. 상시 폴링·통신 후크·화면 함수 감싸기는 하지 않는다.
function loadingStartsSoon(win: Window, graceMs: number, pollMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const until = Date.now() + graceMs;
    const look = () => {
      if (isLoading(win)) return resolve(true);
      if (Date.now() >= until) return resolve(false);
      setTimeout(look, pollMs);
    };
    look();
  });
}

function isUserButtonClick(event: Event): boolean {
  if (!event.isTrusted) return false; // 합성 click·trigger(리모컨의 조회 포함)는 사용자 동작이 아니다
  const target = event.target as Element | null;
  if (typeof target?.closest !== 'function') return false; // 글자 노드 등
  return !target.closest(REMOTE_HOST) && target.closest(BUTTON_LIKE) !== null;
}

export function installActionWatch(win: Window, onSettled: () => void, opts: ActionWatchOptions = {}) {
  const { graceMs = 300, pollMs = 50, loadedIntervalMs } = opts;
  let pending = false; // 한 번의 동작에 알림은 최대 한 번
  const onClick = (event: Event) => {
    if (pending || !isUserButtonClick(event)) return;
    pending = true;
    void loadingStartsSoon(win, graceMs, pollMs)
      .then((started) => (started ? waitUntilLoaded(win, { intervalMs: loadedIntervalMs }).then(onSettled) : undefined))
      .catch(() => undefined) // 10초 넘게 안 끝나면 포기한다
      .finally(() => (pending = false));
  };
  return {
    setEnabled(on: boolean) {
      win.document.removeEventListener('click', onClick, true);
      if (on) win.document.addEventListener('click', onClick, true);
    },
  };
}
