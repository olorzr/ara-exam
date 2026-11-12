import type { ArchiveRow } from '@/hooks/useProblemArchive';
import type { PaperItemSnapshot } from '@/types/problem-bank';

/**
 * 캔버스 카드 한 장에 그릴 것 — 아카이브 행(새로 담은 문항)과 저장된 스냅샷(고치기의 기존 항목)이 같은 모양으로 온다.
 *
 * 기존 항목을 아카이브 행으로 그리면 원본이 그 뒤 바뀐 문항이 **인쇄와 다른 모습**으로 보이고, 원본이 지워진 항목은
 * 그릴 수조차 없다 — 그래서 스냅샷으로 그린다.
 */
export interface CanvasItemDisplay {
  stemHtml: string;
  /** 학교(없으면 출판사) · 연도 */
  sourceLabel: string;
  workTitle: string;
  areaPath: string[];
  hasAnswer: boolean;
  /**
   * 고치기 화면의 갈래 — 저장된 항목(스냅샷) / 새로 담은 문항 / '최신 지문으로' 바꾼 저장 항목(저장할 때 새로 굳힌다).
   * 만들기 화면에서는 비운다
   */
  origin?: 'stored' | 'new' | 'refresh';
  /** 원본 문항이 지워진 저장 항목 */
  orphan?: boolean;
}

/** 출처 한 줄 — 카드에서 예전부터 쓰던 '학교(없으면 출판사) 연도' 그대로 */
function sourceLine(source: { school_name: string; publisher: string; year: string }): string {
  return [source.school_name || source.publisher, source.year].filter(Boolean).join(' ');
}

/**
 * 아카이브 행에서.
 * @param row - 아카이브 행
 * @param origin - 고치기 화면이면 'new'
 * @returns 카드 표시
 */
export function displayOfArchiveRow(row: ArchiveRow, origin?: 'new'): CanvasItemDisplay {
  return {
    stemHtml: row.stem_html,
    sourceLabel: sourceLine(row.source),
    workTitle: row.work_title,
    areaPath: row.area_path,
    hasAnswer: Boolean(row.answer),
    ...(origin ? { origin } : {}),
  };
}

/**
 * 저장된 스냅샷에서.
 * @param snapshot - 항목 스냅샷
 * @param orphan - 원본 문항이 지워졌는가
 * @param origin - 저장된 항목 그대로 / '최신 지문으로' 바꾼 자리(저장할 때 새로 굳힌다)
 * @returns 카드 표시
 */
export function displayOfSnapshot(
  snapshot: PaperItemSnapshot, orphan: boolean, origin: 'stored' | 'refresh' = 'stored',
): CanvasItemDisplay {
  return {
    stemHtml: snapshot.stem_html ?? '',
    sourceLabel: snapshot.source ? sourceLine(snapshot.source) : '',
    workTitle: snapshot.work_title ?? '',
    areaPath: Array.isArray(snapshot.area_path) ? snapshot.area_path : [],
    hasAnswer: Boolean(snapshot.answer),
    origin,
    ...(orphan ? { orphan: true } : {}),
  };
}
