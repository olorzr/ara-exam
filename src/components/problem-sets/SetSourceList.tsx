import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { SourceListRow } from '@/lib/problem-bank/source-list';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import { examViewHref } from '@/lib/problem-bank/source-set-link';
import { mockSubject } from '@/lib/problem-bank/source-sets';

interface SetSourceListProps {
  rows: SourceListRow[];
}

/** 줄 머리 — 내신은 학교, 모의고사는 과목 */
function rowName(row: SourceListRow): string {
  if (row.source_type === MOCK_EXAM_SOURCE_TYPE) return mockSubject(row.title);
  return row.school_name || '학교 미지정';
}

/**
 * 세트 한 장의 학교(모의고사는 과목) 줄 — 누르면 읽기 전용 시험 보기가 열린다.
 * 흰 종이 위에 줄마다 학교 · 제목 · 문항 수. 링크는 미리 받지 않는다(한 세트에 80곳이 넘기도 한다).
 */
export default function SetSourceList({ rows }: SetSourceListProps) {
  return (
    <ol className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-card">
      {rows.map((row, index) => (
        <li key={row.id}>
          <Link
            href={examViewHref(row.id)}
            prefetch={false}
            className="group flex items-center gap-3 px-4 py-3 text-ink hover:bg-accent-soft/40"
          >
            <span aria-hidden="true" className="w-8 shrink-0 font-label text-xs font-bold text-gray-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-bold group-hover:text-primary">{rowName(row)}</span>
              <span className="block truncate text-xs text-gray-500">{row.title}</span>
            </span>
            <span className="shrink-0 text-sm text-gray-600">
              {row.problem_count > 0 ? `${row.problem_count}문항` : '문항 없음'}
            </span>
            <span className="flex shrink-0 items-center text-sm font-semibold">
              보기
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
