// MAIN world에서 화면(menuNo)이 바뀌는 순간을 알린다. 나라장터는 URL이 늘 '/'라 history만 보면 된다.
export interface ScreenChange {
  menuNo: string;
  scrnNo: string;
  menuCangVal: string;
  menuNm: string;
}

type ReadScreen = (win: Window) => ScreenChange | null;

export function installScreenWatch(win: Window, readScreen: ReadScreen, onChange: (change: ScreenChange) => void) {
  let lastMenuNo: string | null = null;
  const check = () => {
    const screen = readScreen(win);
    if (!screen || screen.menuNo === lastMenuNo) return;
    lastMenuNo = screen.menuNo;
    const { menuNo, scrnNo, menuCangVal, menuNm } = screen;
    onChange({ menuNo, scrnNo, menuCangVal, menuNm });
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = win.history[method].bind(win.history);
    win.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      check();
    };
  }
  win.addEventListener('popstate', check);
  win.addEventListener('load', check);
  check();
}
