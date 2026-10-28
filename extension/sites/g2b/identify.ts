import { toText } from './form';

export interface ScreenState {
  menuNo: string;
  scrnNo: string;
  menuCangVal: string;
  menuNm: string;
  state: Record<string, string>;
  param: unknown;
}

const isScalar = (value: unknown): boolean => ['string', 'number', 'boolean'].includes(typeof value);

// 나라장터 URL은 늘 '/'라 화면은 history.state.data의 menuNo로 가른다.
export function readScreenState(win: Window): ScreenState | null {
  const data = (win.history.state as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object' || !data.menuNo) return null;
  const state: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'param' && isScalar(value)) state[key] = toText(value);
  }
  return {
    menuNo: toText(data.menuNo),
    scrnNo: toText(data.scrnNo),
    menuCangVal: toText(data.menuCangVal),
    menuNm: toText(data.menuNm),
    state,
    param: data.param,
  };
}
