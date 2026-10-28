import type { PointField, RawTable } from '../../../shared/types';

function hasWebSquare(win: Window): boolean {
  try {
    return (win as any).$p !== undefined;
  } catch {
    return false;
  }
}

function childFrames(win: Window): Window[] {
  const children: Window[] = [];
  try {
    for (let i = 0; i < win.frames.length; i++) children.push(win.frames[i]);
  } catch {
    // 다른 출처 프레임은 읽을 수 없으니 건너뛴다.
  }
  return children;
}

// 최상위부터 너비 우선. 겹치면 위쪽 프레임이 앞서야 하므로 이 순서가 병합 규칙의 일부다.
export function framesWithWebSquare(win: Window): Window[] {
  const found: Window[] = [];
  const queue: Window[] = [win];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (hasWebSquare(current)) found.push(current);
    queue.push(...childFrames(current));
  }
  return found;
}

// 같은 키가 겹치면 보이는 쪽, 둘 다 같으면 먼저(최상위에 가까운) 쪽.
function mergeByKey<T>(items: T[], keyOf: (item: T) => string, isShown: (item: T) => boolean): T[] {
  const winners = new Map<string, T>();
  for (const item of items) {
    const current = winners.get(keyOf(item));
    if (current === undefined || (!isShown(current) && isShown(item))) winners.set(keyOf(item), item);
  }
  return items.filter((item) => winners.get(keyOf(item)) === item);
}

export function mergeFields(perFrame: PointField[][]): PointField[] {
  return mergeByKey(perFrame.flat(), (f) => f.k, (f) => f.visible);
}

// 표는 dataList가 같으면 같은 표로 본다. dataList가 빈 표는 id로만 가른다.
export function mergeTables(perFrame: RawTable[][]): RawTable[] {
  const keyOf = (t: RawTable) => (t.dataList ? `dl:${t.dataList}` : `id:${t.id}`);
  return mergeByKey(perFrame.flat(), keyOf, (t) => t.visible);
}
