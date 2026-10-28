/// <reference types="chrome" />
export interface PanelState { left?: number; top?: number; collapsed: boolean }
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
  store?: PanelStore;
}

export function attachPanelMotion(parts: Parts) {
  const { doc, bar, bubble, handle, collapseButton, store } = parts;
  const view = () => ({ width: doc.defaultView!.innerWidth, height: doc.defaultView!.innerHeight });
  const state: PanelState = { collapsed: false };
  let dragMoved = false;

  const shown = () => (state.collapsed ? bubble : bar);

  function apply(): void {
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
    event.preventDefault();

    const move = (e: MouseEvent) => {
      if (Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y) > DRAG_SLOP) dragMoved = true;
      state.left = e.clientX - grab.x;
      state.top = e.clientY - grab.y;
      apply();
    };
    const stop = () => {
      doc.removeEventListener('pointermove', move as EventListener);
      doc.removeEventListener('pointerup', stop);
      if (dragMoved) save();
    };
    doc.addEventListener('pointermove', move as EventListener);
    doc.addEventListener('pointerup', stop);
  }

  handle.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('button')) return;
    startDrag(event as MouseEvent, bar);
  });
  bubble.addEventListener('pointerdown', (event) => startDrag(event as MouseEvent, bubble));

  function setCollapsed(collapsed: boolean): void {
    state.collapsed = collapsed;
    apply();
    save();
  }
  collapseButton.addEventListener('click', () => setCollapsed(true));
  bubble.addEventListener('click', () => {
    if (!dragMoved) setCollapsed(false);
    dragMoved = false;
  });

  void store?.load().then((saved) => {
    if (!saved) return;
    if (typeof saved.collapsed === 'boolean') state.collapsed = saved.collapsed;
    if (isNumber(saved.left) && isNumber(saved.top)) {
      state.left = saved.left;
      state.top = saved.top;
    }
    apply();
  }).catch(() => undefined);

  apply();
  return { reapply: apply };
}
