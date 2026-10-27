import type { PageCapture } from '../../plugins/collector/extractor';

/**
 * The js.txt way (user, 2026-10-13, #88): the top window and its direct child frames only, merged into one screen.
 * Tables are named by the grid's screen ID (no getOriginalID, '#n' or frame prefix); a repeated name is overwritten,
 * and a value's key is js.txt's: the getRef() tail when the component has getRef, else the element ID (#125).
 * children first and the top last, as js.txt does, except that an empty top value never hides a child's value.
 * Values stay raw. Collection mode (user, 2026-10-13, #89, a prototype to try): 'all' (①) keeps every pointInfo value,
 * 'skip' (②) drops empty text, null, false and 0 the way js.txt keeps only non-empty text; table rows keep every cell either way.
 * A component or frame that cannot be read is skipped like js.txt, so it never blocks the screen (#125).
 * Serialized by chrome.scripting: every dependency stays inside this function.
 */
export function collectScreen(suppliedWindow?: Window | null, mode: 'all' | 'skip' = 'all'): PageCapture {
  const top = suppliedWindow || window, warnings: string[] = [];
  const pointInfo: Record<string, unknown> = Object.create(null), tables: Record<string, Record<string, unknown>[]> = Object.create(null);
  const clone = (value: unknown): unknown => value === undefined ? null : JSON.parse(JSON.stringify(value, (_key, entry: unknown) => typeof entry === 'bigint' ? String(entry) : entry));
  const scan = (win: Window): void => {
    try {
      const util = (win as Window & { WebSquare?: { util?: { getComponentById(id: string): any } } }).WebSquare?.util;
      if (!util) return;
      win.document.querySelectorAll('[id]').forEach(element => {
        try {
          const component = util.getComponentById(element.id);
          if (!component) return;
          if (typeof component.getPluginName === 'function' && component.getPluginName() === 'gridView') {
            const listRef = component.getDataList?.(), list = typeof listRef === 'string' ? util.getComponentById(listRef) : listRef;
            if (typeof list?.getAllJSON !== 'function') return;
            let rows = list.getAllJSON();
            if (typeof rows === 'string') rows = JSON.parse(rows);
            if (!Array.isArray(rows)) throw new Error('getAllJSON 결과가 배열이 아닙니다.');
            tables[String(component.id || element.id)] = rows.map((row: unknown) => { const copied = clone(row); return copied !== null && typeof copied === 'object' && !Array.isArray(copied) ? copied as Record<string, unknown> : { value: copied }; });
          } else if (typeof component.getValue === 'function') {
            // js.txt: c.getRef ? c.getRef().split('.').pop() : el.id — a getRef that gives no text fails there and is skipped.
            const ref: unknown = component.getRef ? component.getRef() : element.id;
            if (typeof ref !== 'string') return;
            const key = component.getRef ? ref.split('.').pop()! : ref, value = clone(component.getValue());
            if (mode === 'skip' && (value === null || value === false || value === 0 || !String(value).trim())) return;
            if (!(key in pointInfo) || value !== null && !(typeof value === 'string' && !value.trim())) pointInfo[key] = value;
          }
        } catch { /* js.txt skips a component it cannot read */ }
      });
    } catch { /* and a frame it cannot reach */ }
  };
  for (let index = 0; index < top.frames.length; index++) scan(top.frames[index]);
  scan(top);
  return { pointInfo, tables, frames: [{ framePath: 'top', url: top.location.href, pointInfo, tables, fieldSources: {}, warnings }], warnings };
}
