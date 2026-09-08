'use client';

import Link from 'next/link';
import { GripVertical, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import { unitPathLabel } from '@/lib/problem-bank/unit-tree';
import type { Problem, ProblemSource } from '@/types/problem-bank';

/** 목록 카드에서 보여 줄 발문 길이 */
const EXCERPT_LENGTH = 90;

/** 태그를 걷어낸 미리보기 글 */
function excerpt(html: string): string {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_LENGTH ? `${text.slice(0, EXCERPT_LENGTH)}…` : text;
}

interface ProblemCardProps {
  problem: Problem & { source: ProblemSource };
  /** 잘라 둔 영역 이미지 URL (서명됨) */
  thumbnailUrl?: string | null;
  /** 문제지에 담기 — 주면 담기 버튼과 드래그 손잡이가 붙는다 */
  onAdd?: () => void;
  /** 이미 문제지에 담겼는가 */
  added?: boolean;
  /** 드래그 손잡이에 붙일 포인터 핸들러 */
  dragHandlers?: React.HTMLAttributes<HTMLElement>;
  /** 편집 링크를 보일지 (문제지 조합 화면에서는 숨긴다) */
  showEditLink?: boolean;
}

/**
 * 아카이브 문항 카드.
 *
 * 원본 영역 이미지를 함께 보여 준다 — 글로 옮긴 결과만 보면 표·그림이 있던 문항인지
 * 알 수 없어서 문제지에 담고 나서야 이상한 걸 발견하게 된다.
 */
export default function ProblemCard({
  problem, thumbnailUrl, onAdd, added, dragHandlers, showEditLink = true,
}: ProblemCardProps) {
  return (
    <div
      data-drag-item
      className={`flex gap-3 rounded-lg border p-3 transition ${
        added ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {dragHandlers && (
        <button
          type="button"
          {...dragHandlers}
          className="shrink-0 cursor-grab touch-none self-start rounded p-1 text-gray-400 hover:bg-gray-100 active:cursor-grabbing"
          aria-label="끌어서 문제지에 담기"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {thumbnailUrl && (
        // 서명 URL 이라 next/image 최적화 대상이 아니고, 목록에서 지연 로딩이면 깜빡인다
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          className="h-20 w-16 shrink-0 rounded border border-gray-200 object-cover object-top"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{problem.question_type}</Badge>
          {problem.status === '검수완료' && (
            <Badge className="bg-emerald-500 text-white">검수</Badge>
          )}
          {problem.render_mode === 'image' && <Badge variant="outline">이미지</Badge>}
          {!problem.answer && <Badge className="bg-amber-500 text-white">정답 없음</Badge>}
        </div>

        <p className="mt-1 text-sm text-gray-800">{excerpt(problem.stem_html)}</p>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
          <span>{sourceLabel(problem.source)}</span>
          {problem.work_title && <span>· {problem.work_title}</span>}
          {problem.unit_path.length > 0 && <span>· {unitPathLabel(problem.unit_path)}</span>}
          {problem.area_path.length > 0 && <span>· {areaPathLabel(problem.area_path)}</span>}
          {showEditLink && (
            <Link
              href={`/problems/edit/${problem.id}`}
              className="ml-auto text-primary underline underline-offset-2"
            >
              편집
            </Link>
          )}
        </div>
      </div>

      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          disabled={added}
          className="shrink-0 self-start rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-40"
          aria-label={added ? '이미 담김' : '문제지에 담기'}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
