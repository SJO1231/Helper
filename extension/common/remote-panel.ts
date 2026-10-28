/// <reference types="chrome" />
export interface PanelState { left?: number; top?: number; collapsed: boolean; tab?: string }
export interface PanelStore {
  load: () => Promise<Partial<PanelState> | undefined>;
  save: (state: PanelState) => void;
}
interface Point { left: number; top: number }
interface Size { width: number; height: number }

const STORAGE_KEY = 'remotePanel';
const DRAG_SLOP = 3;

export function clampPosition(pos: Point, size: Size, view: Size): Point {
  const limit = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));
  return { left: limit(pos.left, view.width - size.width), top: limit(pos.top, view.height - size.height) };
}

// 저장소가 없으면(시험·확장 밖) 저장을 건너뛴다.
export function chromePanelStore(): PanelStore | undefined {
  const area = typeof chrome !== 'undefined' ? chrome.storage?.local : undefined;
  if (!area) return undefined;
  return {
    async load() {
      const saved = await area.get(STORAGE_KEY);
      return saved[STORAGE_KEY] as Partial<PanelState> | undefined;
    },
    save(state) {
      void area.set({ [STORAGE_KEY]: state }).catch(() => undefined);
    },
  };
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

interface Parts {
  doc: Document;
  bar: HTMLElement;
  bubble: HTMLElement;
  handle: HTMLElement;
  collapseButton: HTMLElement;
  closeButton: HTMLElement;
  host: HTMLElement;
  // 탭 버튼과 칸은 data-tab·data-pane 이름이 짝이다. 첫 탭이 기본이다.
  tabs: { buttons: HTMLElement[]; panes: HTMLElement[] };
  store?: PanelStore;
}

export function attachPanelMotion(parts: Parts) {
  const { doc, bar, bubble, handle, collapseButton, closeButton, host, tabs, store } = parts;
  const view = () => ({ width: doc.defaultView!.innerWidth, height: doc.defaultView!.innerHeight });
  const state: PanelState = { collapsed: false };
  let dragMoved = false;
  let userActed = false;
  let closed = false;
  const tabNames = tabs.buttons.map((button) => button.dataset.tab!);

  const shown = () => (state.collapsed ? bubble : bar);

  function showTab(): void {
    const active = state.tab ?? tabNames[0];
    for (const button of tabs.buttons) {
      const on = button.dataset.tab === active;
      button.setAttribute('aria-selected', String(on));
      button.classList.toggle('active', on);
    }
    for (const pane of tabs.panes) pane.hidden = pane.dataset.pane !== active;
  }

  function apply(): void {
    showTab();
    bar.hidden = state.collapsed;
    bubble.hidden = !state.collapsed;
    if (state.left === undefined || state.top === undefined) return;
    for (const node of [bar, bubble]) {
      const rect = node.getBoundingClientRect();
      const next = clampPosition({ left: state.left, top: state.top }, rect, view());
      node.style.left = `${next.left}px`;
      node.style.top = `${next.top}px`;
      node.style.right = 'auto';
    }
    const clamped = clampPosition({ left: state.left, top: state.top }, shown().getBoundingClientRect(), view());
    state.left = clamped.left;
    state.top = clamped.top;
  }
  const save = () => store?.save({ ...state });

  function startDrag(event: MouseEvent, target: HTMLElement): void {
    if (event.button !== 0) return;
    const rect = target.getBoundingClientRect();
    const grab = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const origin = { x: event.clientX, y: event.clientY };
    dragMoved = false;
    userActed = true;
    event.preventDefault();
    // 포인터가 창 밖이나 iframe 위로 나가도 move·up을 계속 받으려는 것이다.
    try {
      (event.currentTarget as Element | null)?.setPointerCapture?.((event as PointerEvent).pointerId);
    } catch {
      /* 잡을 수 없는 포인터면 문서 이벤트만으로 끈다 */
    }

    const move = (e: MouseEvent) => {
      if (Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y) > DRAG_SLOP) dragMoved = true;
      state.left = e.clientX - grab.x;
      state.top = e.clientY - grab.y;
      apply();
    };
    const stop = () => {
      doc.removeEventListener('pointermove', move as EventListener);
      doc.removeEventListener('pointerup', stop);
      doc.removeEventListener('pointercancel', stop);
      if (dragMoved) save();
    };
    doc.addEventListener('pointermove', move as EventListener);
    doc.addEventListener('pointerup', stop);
    doc.addEventListener('pointercancel', stop);
  }

  handle.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    startDrag(event as MouseEvent, bar);
  });
  bubble.addEventListener('pointerdown', (event) => startDrag(event as MouseEvent, bubble));

  function setCollapsed(collapsed: boolean): void {
    userActed = true;
    state.collapsed = collapsed;
    apply();
    save();
  }
  collapseButton.addEventListener('click', () => setCollapsed(true));
  bubble.addEventListener('click', () => {
    if (!dragMoved) setCollapsed(false);
    dragMoved = false;
  });

  for (const button of tabs.buttons) {
    button.addEventListener('click', () => {
      userActed = true;
      state.tab = button.dataset.tab;
      apply();
      save();
    });
  }
  // 종료는 저장된 위치·접힘을 건드리지 않고 이 페이지가 살아 있는 동안만 떼어 둔다.
  closeButton.addEventListener('click', () => {
    closed = true;
    host.remove();
  });

  function resetPosition(): void {
    userActed = true;
    delete state.left;
    delete state.top;
    for (const node of [bar, bubble]) {
      node.style.left = '';
      node.style.top = '';
      node.style.right = '';
    }
    save();
  }

  // 문서 하나에 한 번만 붙인다. 패널을 다시 붙여도 이 함수는 다시 불리지 않는다.
  doc.addEventListener('keydown', (event) => {
    const isG = event.code === 'KeyG' || event.key?.toLowerCase() === 'g';
    if (!event.altKey || event.ctrlKey || event.metaKey || !isG) return;
    event.preventDefault();
    if (event.shiftKey) return resetPosition();
    if (closed) {
      closed = false;
      doc.body.appendChild(host);
      apply();
      return;
    }
    setCollapsed(!state.collapsed);
  });

  void store?.load().then((saved) => {
    // 불러오는 사이 사용자가 만졌으면 사용자의 것이 우선이다.
    if (!saved || userActed) return;
    if (typeof saved.collapsed === 'boolean') state.collapsed = saved.collapsed;
    if (typeof saved.tab === 'string' && tabNames.includes(saved.tab)) state.tab = saved.tab;
    if (isNumber(saved.left) && isNumber(saved.top)) {
      state.left = saved.left;
      state.top = saved.top;
    }
    apply();
  }).catch(() => undefined);

  doc.defaultView?.addEventListener('resize', apply);
  apply();
  return { reapply: apply, isClosed: () => closed };
}
