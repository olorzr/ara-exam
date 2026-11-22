import Link from 'next/link';
import { ChevronRight, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SourceListRow } from '@/lib/problem-bank/source-list';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import { examViewHref, sourceEditHref } from '@/lib/problem-bank/source-set-link';
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
 * 세트 한 장의 학교(모의고사는 과목) 줄 — 줄을 누르면 읽기 전용 시험 보기, '고치기' 는 원본 대조 고치기 화면.
 *
 * 2026-11-22 '올라간 기출' 과 한 메뉴('기출 시험지')가 되며 고치기 입구와 적재 확인거리 꼬리표(목록 표와 같은 값)를 더했다.
 * ⚠️ 줄 전체를 링크로 감싸지 않는다 — 그 안에 '고치기' 링크가 있다(링크 안 링크는 잘못된 HTML, 0.9.89 규약). 보기 링크는
 * 이름을 감싸고 `after:absolute after:inset-0` 로 줄을 덮고, 고치기 링크는 그 위(`relative z-10`)다.
 * 링크는 미리 받지 않는다(한 세트에 80곳이 넘기도 한다).
 */
export default function SetSourceList({ rows }: SetSourceListProps) {
  return (
    <ol className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-card">
      {rows.map((row, index) => {
        const warnings = row.ocr_meta?.warnings?.length ?? 0;
        return (
          <li key={row.id} className="group relative flex items-center gap-3 px-4 py-3 text-ink hover:bg-accent-soft/40">
            <span aria-hidden="true" className="w-8 shrink-0 font-label text-xs font-bold text-gray-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            {/* 문항 수·꼬리표는 이름 아래 줄 — 오른쪽에 두면 휴대폰에서 학교 이름이 한 글자씩 꺾인다.
                시험 제목·꼬리표까지 보기 링크 안이다: 같은 학교 이름의 시험이 화면 읽기 프로그램에서 갈리고(코덱스 2R),
                꼬리표를 눌러도 시험지가 열린다(코덱스 4R) */}
            <Link
              href={examViewHref(row.id)}
              prefetch={false}
              className="flex min-w-0 flex-1 items-center gap-3 after:absolute after:inset-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold group-hover:text-primary">{rowName(row)}</span>
                <span className="block truncate text-xs text-gray-500">{row.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  {row.problem_count > 0 ? (
                    <span>{row.problem_count}문항</span>
                  ) : (
                    // 문항이 없는 시험지는 적재가 덜 끝난 것이다 — 목록 표와 같은 꼬리표
                    <Badge variant="warn">문항 없음</Badge>
                  )}
                  {/* 줄을 덮는 링크 그림(::after) 위로 올려 풍선 글이 뜨게 — 링크 안이라 눌러도 열린다.
                      꼬리표는 모양을 덮을 수 없어(0.9.88) 감싼 상자가 올라간다 */}
                  {warnings > 0 && (
                    <span className="relative z-10 cursor-help" title="적재할 때 남긴 확인거리 — 고치기 화면 위쪽에 모여 있어요">
                      <Badge variant="warn">확인 필요 {warnings}</Badge>
                    </span>
                  )}
                </span>
              </span>
              {/* 보이는 '보기' 도 링크 안 — 음성 조작으로 '보기' 를 불러도 이 링크가 잡힌다(코덱스 7R).
                  휴대폰에서도 보인다 — 숨기면 학교 이름이 그냥 글로 보여 '고치기' 만 누를 것처럼 보인다(코덱스 8R) */}
              <span className="flex shrink-0 items-center text-sm font-semibold">
                보기
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>
            <Link
              href={sourceEditHref(row.id)}
              prefetch={false}
              aria-label={`${rowName(row)} · ${row.title} 원본 대조로 고치기`}
              className="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-300 bg-card px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-ink hover:text-ink"
            >
              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
              고치기
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
