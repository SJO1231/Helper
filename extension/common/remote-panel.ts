/// <reference types="chrome" />
export interface PanelState { left?: number; top?: number; collapsed: boolean; tab?: string; autoCollect?: boolean }
export type PanelField = keyof PanelState;
export interface PanelStore {
  load: () => Promise<Partial<PanelState> | undefined>;
  // fields만 저장된 값에 합친다. 다른 탭이 바꾼 나머지 필드는 덮지 않는다.
  save: (state: PanelState, fields: PanelField[]) => void;
  // 다른 탭이 저장값을 바꾸면 알린다.
  subscribe?: (listener: (saved: Partial<PanelState>) => void) => void;
}
interface Point { left: number; top: number }
interface Size { width: number; height: number }

const STORAGE_KEY = 'remotePanel';
const DRAG_SLOP = 3;

export function clampPosition(pos: Point, size: Size, view: Size): Point {
  const limit = (value: number, max: number) => Math.min(Math.max(value, 0), Math.max(max, 0));
  return { left: limit(pos.left, view.width - size.width), top: limit(pos.top, view.height - size.height) };
}

export function mergePanelState(current: Partial<PanelState> | undefined, state: PanelState, fields: PanelField[]) {
  const merged: Record<string, unknown> = { ...current };
  for (const field of fields) {
    if (state[field] === undefined) delete merged[field];
    else merged[field] = state[field];
  }
  return merged as Partial<PanelState>;
}

// 저장소가 없으면(시험·확장 밖) 저장을 건너뛴다.
export function chromePanelStore(): PanelStore | undefined {
  const area = typeof chrome !== 'undefined' ? chrome.storage?.local : undefined;
  if (!area) return undefined;
  return {
    async load() {
      try {
        const saved = await area.get(STORAGE_KEY);
        return saved[STORAGE_KEY] as Partial<PanelState> | undefined;
      } catch {
        return undefined;
      }
    },
    save(state, fields) {
      // 저장 직전에 다시 읽어, 이 패널이 바꾼 필드만 합친다.
      void area.get(STORAGE_KEY)
        .then((saved) => {
          const current = saved[STORAGE_KEY] as Partial<PanelState> | undefined;
          return area.set({ [STORAGE_KEY]: mergePanelState(current, state, fields) });
        })
        .catch(() => undefined);
    },
    subscribe(listener) {
      chrome.storage.onChanged?.addListener((changes, areaName) => {
        const next = changes[STORAGE_KEY]?.newValue;
        if (areaName === 'local' && next && typeof next === 'object') listener(next as Partial<PanelState>);
      });
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
  // 자동수집 스위치. 값은 같은 remotePanel에 저장하고, 바뀌거나 복원될 때마다 알린다.
  autoCollect?: { box: HTMLInputElement; onChange: (on: boolean) => void };
}

export function attachPanelMotion(parts: Parts) {
  const { doc, bar, bubble, handle, collapseButton, closeButton, host, tabs, store, autoCollect } = parts;
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
  const save = (...fields: PanelField[]) => store?.save({ ...state }, fields);

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
      if (dragMoved) save('left', 'top');
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
    // 접힌 칸에 포커스가 남으면 보이지 않는 요소가 키 입력을 받는다.
    if (collapsed) ((bar.getRootNode() as ShadowRoot).activeElement as HTMLElement | null)?.blur();
    state.collapsed = collapsed;
    apply();
    save('collapsed');
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
      save('tab');
    });
  }
  autoCollect?.box.addEventListener('change', () => {
    userActed = true;
    state.autoCollect = autoCollect.box.checked;
    save('autoCollect');
    autoCollect.onChange(state.autoCollect);
  });
  store?.subscribe?.((saved) => {
    if (!autoCollect || typeof saved.autoCollect !== 'boolean') return;
    if (saved.autoCollect === Boolean(state.autoCollect)) return;
    state.autoCollect = saved.autoCollect;
    autoCollect.box.checked = saved.autoCollect;
    autoCollect.onChange(saved.autoCollect);
  });
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
    save('left', 'top');
  }

  // 문서 하나에 한 번만 붙인다. 패널을 다시 붙여도 이 함수는 다시 불리지 않는다.
  // 캡처 단계: 사이트가 stopPropagation 해도 받는다.
  doc.addEventListener('keydown', (event) => {
    if (event.repeat) return;
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
  }, true);

  void store?.load().then((saved) => {
    // 불러오는 사이 사용자가 만졌으면 사용자의 것이 우선이다.
    if (!saved || userActed) return;
    if (typeof saved.collapsed === 'boolean') state.collapsed = saved.collapsed;
    if (typeof saved.tab === 'string' && tabNames.includes(saved.tab)) state.tab = saved.tab;
    if (saved.autoCollect === true && autoCollect) {
      state.autoCollect = true;
      autoCollect.box.checked = true;
      autoCollect.onChange(true);
    }
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
