import type { Reply } from './background';

export interface ScreenChoice { menu_no: string; menu_cang_val: string; name: string }

export interface DirectLinkDeps {
  doc: Document;
  send: (message: Record<string, unknown>) => Promise<Reply<any>>;
  say: (text: string) => void;
  noteFailure: (reply: Extract<Reply, { ok: false }>) => void;
  currentMenuNo: () => string | null;
  onNavigated: () => void;
}

// 리모컨 '업무' 탭의 직링크 줄. 목록은 background가 dict_screen 행에서 만들어 준다.
export function createDirectLink(deps: DirectLinkDeps) {
  const { doc, send, say, noteFailure, currentMenuNo, onNavigated } = deps;
  const select = doc.createElement('select');
  select.setAttribute('data-role', 'screen-select');
  const goButton = doc.createElement('button');
  goButton.setAttribute('data-action', 'open-screen');
  goButton.setAttribute('type', 'button');
  goButton.textContent = '이동';
  let seq = 0;

  function show(choices: ScreenChoice[]): void {
    select.replaceChildren(...choices.map((choice) => {
      const option = doc.createElement('option');
      option.value = choice.menu_no;
      option.textContent = choice.name || choice.menu_no;
      return option;
    }));
    select.disabled = goButton.disabled = choices.length === 0;
    const current = currentMenuNo();
    if (current !== null && choices.some((c) => c.menu_no === current)) select.value = current;
  }

  // 화면을 연달아 바꾸면 늦게 온 옛 답이 새 목록을 덮을 수 있어 순번이 맞는 답만 쓴다.
  async function refresh(): Promise<void> {
    const mine = ++seq;
    const reply = await send({ kind: 'screen-list' });
    if (mine !== seq) return;
    show(reply.ok && Array.isArray(reply.data) ? reply.data : []);
  }

  goButton.addEventListener('click', async () => {
    const choice = select.selectedOptions[0];
    if (!choice) return;
    const reply = await send({ kind: 'open-screen', menuNo: choice.value });
    if (!reply.ok) return noteFailure(reply);
    const { ok, reason } = reply.data as { ok: boolean; reason?: string };
    say(ok ? `이동: ${choice.textContent}` : (reason ?? '이동하지 못함'));
    if (ok) onNavigated();
  });

  show([]);
  return { select, goButton, refresh };
}
