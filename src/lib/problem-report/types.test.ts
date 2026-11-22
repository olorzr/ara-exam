import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PaperItemSnapshot } from '@/types/problem-bank';
import {
  REPORT_CATEGORIES, REPORT_CATEGORY_LABELS, REPORT_NOTE_MAX, isReportCategory, reportExcerpt, reportPlaceLabel,
  withOriginalNumber,
} from './types';

const snap = (over: Partial<PaperItemSnapshot> = {}) => ({ stem_html: '<p>물음</p>', number: 17, ...over }) as PaperItemSnapshot;

describe('신고 종류', () => {
  it('종류 값은 sql/113 CHECK 와 같다', () => {
    const sql = readFileSync(join(process.cwd(), 'sql/113_problem_reports.sql'), 'utf8');
    const check = /category\s+TEXT NOT NULL CHECK \(category IN \(([^)]*)\)\)/.exec(sql)?.[1] ?? '';
    expect(check.split(',').map((s) => s.trim().replace(/'/g, ''))).toEqual(REPORT_CATEGORIES.map((c) => c.value));
    expect(sql).toContain(`CHECK (length(note) <= ${REPORT_NOTE_MAX})`);
  });

  it('이름표와 판정', () => {
    expect(REPORT_CATEGORY_LABELS.answer).toBe('정답 오류');
    expect(isReportCategory('figure')).toBe(true);
    expect(isReportCategory('evil')).toBe(false);
  });
});

describe('reportExcerpt', () => {
  it('발문을 한 줄 평문으로, 길면 자른다', () => {
    expect(reportExcerpt(snap({ stem_html: '<p>&lt;보기&gt;를 <u>보고</u></p><p>답하라</p>' }))).toBe('<보기>를 보고 답하라');
    expect(reportExcerpt(snap({ stem_html: `<p>${'가'.repeat(200)}</p>` })).endsWith('…')).toBe(true);
    expect(reportExcerpt(null)).toBe('');
  });
});

describe('reportPlaceLabel', () => {
  it('문제지에서 신고했으면 제목과 번호, 문제 은행이면 원래 번호', () => {
    expect(reportPlaceLabel({ paper_title: '춘향전', printed_no: 20, snapshot: snap() })).toBe('춘향전 20번');
    expect(reportPlaceLabel({ paper_title: null, printed_no: null, snapshot: snap() })).toBe('문제 은행 · 원래 17번');
    expect(reportPlaceLabel({ paper_title: null, printed_no: null, snapshot: snap({ number: null }) })).toBe('문제 은행');
  });
});

describe('withOriginalNumber — 출처 줄에 원래 번호 (2026-11-22)', () => {
  it('번호가 있으면 · 원래 N번 을 붙인다', () => {
    expect(withOriginalNumber('2025 고1 휘경여고 2학기 기말', 12)).toBe('2025 고1 휘경여고 2학기 기말 · 원래 12번');
  });
  it('번호가 없거나 이상하면 출처 줄 그대로', () => {
    expect(withOriginalNumber('출처', null)).toBe('출처');
    expect(withOriginalNumber('출처', '12')).toBe('출처');
    expect(withOriginalNumber('출처', 0)).toBe('출처');
    expect(withOriginalNumber('출처', 1.5)).toBe('출처');
  });
  it('출처 줄이 비면 번호만', () => {
    expect(withOriginalNumber(null, 3)).toBe('원래 3번');
    expect(withOriginalNumber('', null)).toBe('');
  });
});
