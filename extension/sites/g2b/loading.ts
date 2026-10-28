import { isVisible } from './body';

const PROCESS_BAR_ID = '__processbarIFrame';

export interface WaitOptions { intervalMs?: number; timeoutMs?: number }

// 진행 표시가 보이면 아직 불러오는 중이다. 간격마다 다시 보고 한도를 넘으면 'loading'으로 거절한다.
export function waitUntilLoaded(win: Window, opts: WaitOptions = {}): Promise<void> {
  const intervalMs = opts.intervalMs ?? 200;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const isLoading = () => {
    const bar = win.document.getElementById(PROCESS_BAR_ID);
    return bar !== null && isVisible(bar);
  };
  return new Promise((resolve, reject) => {
    if (!isLoading()) return resolve();
    const finish = (done: () => void) => {
      clearInterval(poll);
      clearTimeout(limit);
      done();
    };
    const poll = setInterval(() => {
      if (!isLoading()) finish(resolve);
    }, intervalMs);
    const limit = setTimeout(() => finish(() => reject(new Error('loading'))), timeoutMs);
  });
}
