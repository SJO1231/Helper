import { Window } from 'happy-dom';
import { createRemote } from './remote';
import { mergePanelState } from './remote-panel';
import type { PanelState, PanelStore } from './remote-panel';


export const SIZE = { width: 260, height: 100 };
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

type Listener = (next: Partial<PanelState>) => void;
export interface SharedPanelStorage {
  data?: Partial<PanelState>;
  watchers: Array<{ owner: object; listener: Listener }>;
}

// shared를 같이 쓰는 두 저장소는 서로 다른 탭이 한 chrome.storage를 쓰는 것과 같다(onChanged는 다른 탭에만 간다).
export function memoryStore(initial?: Partial<PanelState>, shared: SharedPanelStorage = { watchers: [] }) {
  const saved: PanelState[] = [];
  const owner = {};
  shared.data ??= initial;
  const store: PanelStore = {
    load: async () => shared.data,
    save: (state, fields) => {
      saved.push(state);
      shared.data = mergePanelState(shared.data, state, fields);
      for (const watcher of shared.watchers) if (watcher.owner !== owner) watcher.listener(shared.data);
    },
    subscribe: (listener) => void shared.watchers.push({ owner, listener }),
  };
  return { store, saved };
}

export async function mount(initial?: Partial<PanelState>, slowLoad = false, shared?: SharedPanelStorage) {
  const win = new Window({ url: 'https://example.invalid/', width: 1000, height: 700 }) as any;
  const { store, saved } = memoryStore(initial, shared);
  let finishLoad: () => void = () => undefined;
  if (slowLoad) {
    store.load = () => new Promise((resolve) => (finishLoad = () => resolve(initial)));
  }
  const send = async () => ({ ok: true, data: null }) as any;
  const remote = createRemote({ doc: win.document, send, panelStore: store });
  const q = (selector: string) => remote.root.querySelector(selector) as any;
  // happy-dom은 배치를 계산하지 않아 크기와 위치를 style에서 읽어 주는 가짜 상자를 붙인다.
  for (const node of [q('.bar'), q('.bubble')]) {
    node.getBoundingClientRect = () => ({
      left: parseFloat(node.style.left) || 0, top: parseFloat(node.style.top) || 0, ...SIZE,
    });
  }
  await settle();
  const fire = (target: any, type: string, x: number, y: number) =>
    target.dispatchEvent(new win.MouseEvent(type, { bubbles: true, composed: true, clientX: x, clientY: y }));
  return { win, remote, q, saved, fire, finishLoad: () => finishLoad() };
}
