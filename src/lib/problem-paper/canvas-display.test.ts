import { describe, expect, it } from 'vitest';
import { displayOfArchiveRow, displayOfSnapshot } from './canvas-display';
import type { ArchiveRow } from '@/hooks/useProblemArchive';
import type { PaperItemSnapshot } from '@/types/problem-bank';

const source = { school_name: '', publisher: '천재', year: '2026' };

describe('canvas-display', () => {
  it('아카이브 행 — 출처는 학교(없으면 출판사) 연도, 고치기면 새로 담음', () => {
    const row = {
      stem_html: '<p>발문</p>', source, work_title: '서시', area_path: ['문학'], answer: '',
    } as unknown as ArchiveRow;
    expect(displayOfArchiveRow(row)).toEqual({
      stemHtml: '<p>발문</p>', sourceLabel: '천재 2026', workTitle: '서시', areaPath: ['문학'], hasAnswer: false,
    });
    expect(displayOfArchiveRow(row, 'new').origin).toBe('new');
  });

  it('스냅샷 — 저장된 항목, 원본이 지워졌으면 표시한다', () => {
    const snapshot = {
      stem_html: '<p>옛 발문</p>', source: { ...source, school_name: '상현중' }, work_title: '', area_path: [], answer: '3',
    } as unknown as PaperItemSnapshot;
    expect(displayOfSnapshot(snapshot, false)).toEqual({
      stemHtml: '<p>옛 발문</p>', sourceLabel: '상현중 2026', workTitle: '', areaPath: [], hasAnswer: true, origin: 'stored',
    });
    expect(displayOfSnapshot(snapshot, true).orphan).toBe(true);
  });
});
