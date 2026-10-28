// 이 폴더의 함수는 MAIN world로 묶여 실행된다. WebSquare 객체는 늘 인자로 받은 창에서만 꺼낸다.
const BODY_ID = 'mf_wfm_container';

export type ElementFilter = (el: Element) => boolean;

// 본문 판정은 id 접두어가 아니라 DOM 포함 관계다. 첨부파일 그리드 id(wq_uuid_N_)는 접두어가 다르다.
export function inBody(el: Element, doc: Document): boolean {
  const root = doc.getElementById(BODY_ID);
  return root !== null && root.contains(el);
}

export function isVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

export function componentOf(win: Window, el: Element): any | null {
  const component = (win as any)[el.id];
  const isComponent = component && typeof component === 'object' && typeof component.getPluginName === 'function';
  return isComponent ? component : null;
}

export function isGrid(component: any): boolean {
  return component.getPluginName() === 'gridView';
}
