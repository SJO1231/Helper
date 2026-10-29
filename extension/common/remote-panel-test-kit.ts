import { Window } from 'happy-dom';
import { createRemote } from './remote';
import type { PanelState, PanelStore } from './remote-panel';


export const SIZE = { width: 260, height: 100 };
export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export function memoryStore(initial?: Partial<PanelState>) {
  const saved: PanelState[] = [];
  const store: PanelStore = {
    load: async () => initial,
    save: (state) => void saved.push(state),
  };
  return { store, saved };
}

export async function mount(initial?: Partial<PanelState>, slowLoad = false) {
  const win = new Window({ url: 'https://example.invalid/', width: 1000, height: 700 }) as any;
  const { store, saved } = memoryStore(initial);
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
