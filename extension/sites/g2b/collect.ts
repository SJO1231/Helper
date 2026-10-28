import type { Diagnostics, ExtractMode, PointField, RawCapture, RawTable } from '../../../shared/types';
import { inBody, isVisible } from './body';
import type { ElementFilter } from './body';
import { readForm } from './form';
import { framesWithWebSquare, mergeFields, mergeTables } from './frames';
import { readGrids } from './grids';
import { readScreenState } from './identify';
import { waitUntilLoaded } from './loading';
import { flattenParam } from './param';

export interface CollectedScreen {
  raw: RawCapture;
  diag: Diagnostics;
  screen: { menuNo: string; scrnNo: string; menuNm: string };
}

// 보이는 것만(본문 안·보임), 숨김 포함(본문 안 전부), 전체(문서 전체).
function filterFor(mode: ExtractMode, doc: Document): ElementFilter {
  if (mode === 'all') return () => true;
  if (mode === 'hidden') return (el) => inBody(el, doc);
  return (el) => inBody(el, doc) && isVisible(el);
}

export async function collectScreen(win: Window, mode: ExtractMode): Promise<CollectedScreen> {
  await waitUntilLoaded(win);
  const before = readScreenState(win);
  if (!before) throw new Error('no-screen');

  const fieldsPerFrame: PointField[][] = [];
  const tablesPerFrame: RawTable[][] = [];
  const dropped = { emptyRef: 0, sameDataList: 0, failedGrids: 0 };
  for (const frame of framesWithWebSquare(win)) {
    const filter = filterFor(mode, frame.document);
    const form = readForm(frame, filter);
    const grids = readGrids(frame, filter);
    fieldsPerFrame.push(form.fields);
    tablesPerFrame.push(grids.tables);
    dropped.emptyRef += form.droppedEmptyRef;
    dropped.sameDataList += grids.droppedSameDataList;
    dropped.failedGrids += grids.failedGrids;
  }

  // 읽는 사이 사용자가 다른 화면으로 갔다면 반쯤 읽은 결과를 보내지 않는다.
  const after = readScreenState(win);
  if (!after || after.menuNo !== before.menuNo) throw new Error('screen-changed');

  const pointInfo = mergeFields(fieldsPerFrame);
  const tables = mergeTables(tablesPerFrame);
  const { param, dropped: droppedParam } = flattenParam(before.param);
  const diag: Diagnostics = {
    forms: pointInfo.length,
    grids: tables.length,
    droppedEmptyRef: dropped.emptyRef,
    droppedSameDataList: dropped.sameDataList,
    failedGrids: dropped.failedGrids,
    droppedParam,
    unknownKeys: 0, // 사전을 아는 background가 채운다
    core: 'ok',
  };
  const { menuNo, scrnNo, menuNm } = before;
  return { raw: { state: before.state, param, pointInfo, tables }, diag, screen: { menuNo, scrnNo, menuNm } };
}
