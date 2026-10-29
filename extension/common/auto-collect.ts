export const AUTO_TOAST_PREFIX = '자동 ';

interface AutoCollectState {
  on: boolean;
  busy: boolean;
  menuNo: string | null;
  screenKnown: boolean;
  stage: string | null | undefined;
}

// 조용히 건너뛰는 조건: 꺼짐·진행 중·화면 모름·stage 없음(코어 꺼짐이면 화면 사전을 몰라 screenKnown이 거짓).
export function shouldAutoCollect(s: AutoCollectState): boolean {
  return s.on && !s.busy && s.menuNo !== null && s.screenKnown && Boolean(s.stage);
}

// MAIN world는 chrome.storage를 못 읽어서 스위치 값을 postMessage로 넘긴다.
export function announceAutoCollect(win: Window | null | undefined, on: boolean): void {
  win?.postMessage({ source: 'helper-remote', type: 'auto-collect', on }, '*');
}

// 리모컨이 조회처럼 화면 동작을 일으킨 뒤, MAIN world에 로딩이 끝나는지 한 번 지켜 달라고 한다.
export function requestSettleWatch(win: Window | null | undefined): void {
  win?.postMessage({ source: 'helper-remote', type: 'watch-settle' }, '*');
}

export function createAutoCollectToggle(doc: Document) {
  const label = doc.createElement('label');
  const box = doc.createElement('input');
  box.type = 'checkbox';
  box.setAttribute('data-role', 'auto-collect');
  label.append(box, doc.createTextNode(' 버튼 동작 뒤 자동수집'));
  return { label, box };
}
