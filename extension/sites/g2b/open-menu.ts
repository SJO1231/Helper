import { childFrames } from './frames';

interface Mover { gfnOpenMenuMove: (menuCangVal: string) => unknown }
export interface OpenMenuResult { ok: boolean; reason?: string }

function moverOf(win: Window): Mover | null {
  try {
    const com = (win as any).com;
    return typeof com?.gfnOpenMenuMove === 'function' ? com : null;
  } catch {
    return null;
  }
}

// 최상위부터 너비 우선으로 com.gfnOpenMenuMove를 가진 첫 창을 찾는다.
function findMover(win: Window): Mover | null {
  const queue: Window[] = [win];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const mover = moverOf(current);
    if (mover) return mover;
    queue.push(...childFrames(current));
  }
  return null;
}

// 둘째·셋째 인자는 넘기지 않는다: 실측으로 menuCangVal 하나만으로 이동됨(PLAN 82줄).
export function openMenu(win: Window, menuCangVal: string): OpenMenuResult {
  const mover = findMover(win);
  if (!mover) return { ok: false, reason: '이 화면에서 com.gfnOpenMenuMove를 찾지 못함' };
  try {
    mover.gfnOpenMenuMove(menuCangVal);
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
