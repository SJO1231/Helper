import type { Diagnostics } from '../../shared/types';
import type { CaptureReply } from './background';

export interface DiagExtra { registeredScreens?: number; restored?: number; autoCollected?: number }

// 진단 줄: 읽은 폼·그리드 수, 뺀 수, 미등록 키 수, 새로 등록한 화면, 되살림, 코어 연결 상태.
export function formatDiagnostics(d: Diagnostics, extra: DiagExtra = {}): string {
  return [
    `폼 ${d.forms}`,
    `그리드 ${d.grids}`,
    `빈 ref 제외 ${d.droppedEmptyRef}`,
    `같은 표 제외 ${d.droppedSameDataList}`,
    `읽기 실패 그리드 ${d.failedGrids}`,
    `param 버림 ${d.droppedParam}`,
    `미등록 키 ${d.unknownKeys}`,
    `새로 등록한 화면 ${extra.registeredScreens ?? 0}`,
    `되살림 ${extra.restored ?? 0}건`,
    `자동수집 ${extra.autoCollected ?? 0}회`,
    d.core === 'ok' ? '코어 연결' : '코어 꺼짐',
  ].join(' · ');
}

export function formatCaptureResult(result: CaptureReply): string {
  const restored = result.restored ? ' · 휴지통에서 되살림' : '';
  switch (result.status) {
    case 'changed': return `바뀐 칸 ${result.changed.length}개${restored}`;
    case 'new': return `새로 저장함${restored}`;
    case 'same': return `바뀐 것 없음${restored}`;
    default: return `거절: ${result.reason ?? '이유 없음'}`;
  }
}

const PAGE_ERROR_TEXT: Record<string, string> = {
  loading: '화면을 불러오는 중이라 읽지 못함',
  'no-screen': '화면 정보를 찾지 못함',
  'screen-changed': '읽는 동안 화면이 바뀜',
  'not-ready': '화면 도우미가 아직 준비되지 않음',
  'no-result': '화면에서 답이 오지 않음',
  offline: '코어 꺼짐',
};

export function formatFailure(code: string, error: string): string {
  return PAGE_ERROR_TEXT[code] ?? error;
}
