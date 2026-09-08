'use client';

import Link from 'next/link';
import { GripVertical, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { areaPathLabel } from '@/lib/problem-bank/area-tree';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import { parseGrammarPath } from '@/lib/problem-bank/grammar-tree';
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
  /** 선택 모드 — 체크박스가 붙고 카드를 눌러도 선택이 토글된다 (조합 화면은 쓰지 않는다) */
  selectMode?: boolean;
  /** 이 문항이 선택됐는가 */
  selected?: boolean;
  /** 선택 토글 */
  onToggleSelect?: () => void;
  /** 카드를 누르면 상세 창을 연다 (선택 모드에서는 선택이 우선이다) */
  onOpen?: () => void;
}

/**
 * 아카이브 문항 카드.
 *
 * 원본 영역 이미지를 함께 보여 준다 — 글로 옮긴 결과만 보면 표·그림이 있던 문항인지
 * 알 수 없어서 문제지에 담고 나서야 이상한 걸 발견하게 된다.
 */
export default function ProblemCard({
  problem, thumbnailUrl, onAdd, added, dragHandlers, showEditLink = true,
  selectMode, selected, onToggleSelect, onOpen,
}: ProblemCardProps) {
  const selectable = Boolean(selectMode && onToggleSelect);
  const openable = Boolean(onOpen) && !selectable;

  /**
   * 카드를 눌렀다 — 상세 창을 연다.
   *
   * ⚠️ 글자를 끌어 선택하고 손을 떼도 click 이 온다. 그때 창이 열리면 **읽으려고 긁은
   *    사람이 창에 갇힌다** — 선택한 글자가 있으면 열지 않는다.
   */
  const handleOpen = () => {
    if (window.getSelection()?.toString()) return;
    onOpen?.();
  };

  /** 안쪽 조작(편집·담기·손잡이)이 카드 클릭까지 번지지 않게 */
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      data-drag-item
      role={openable ? 'button' : undefined}
      tabIndex={openable ? 0 : undefined}
      aria-label={openable
        ? `${problem.number !== null ? `${problem.number}번 ` : ''}문항 자세히 보기`
        : undefined}
      className={`flex gap-3 rounded-lg border p-3 transition ${
        added ? 'border-primary bg-primary/5'
          : selected ? 'border-primary ring-1 ring-primary/30'
            : 'border-gray-200 hover:border-gray-300'
      } ${selectable || openable ? 'cursor-pointer' : ''}`}
      onClick={selectable ? onToggleSelect : openable ? handleOpen : undefined}
      onKeyDown={openable ? (e) => {
        // ⚠️ 안쪽 버튼·링크에서 올라온 Enter·Space 는 그 컨트롤의 것이다.
        //    가로채면 키보드로는 편집 링크를 열 수 없고 상세 창만 뜬다(코덱스 리뷰 P2)
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      } : undefined}
    >
      {selectable && (
        // 체크박스 자체의 클릭이 카드 클릭으로 두 번 세지 않게 막는다
        <div className="shrink-0 self-start pt-0.5" onClick={stop}>
          <Checkbox
            checked={!!selected}
            onCheckedChange={onToggleSelect}
            aria-label={`${problem.number !== null ? `${problem.number}번 ` : ''}문항 선택`}
          />
        </div>
      )}

      {dragHandlers && (
        <button
          type="button"
          {...dragHandlers}
          // ⚠️ 손잡이는 click 도 막아야 한다. useListDrag 의 preventDefault 는 호환
          //    mouse 이벤트만 막고, 포인터를 잡아 둔 탓에 pointerup 대상이 손잡이라
          //    **끌기를 끝낼 때마다** click 이 카드로 번져 상세 창이 열린다
          onClick={stop}
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
          {/* 문법은 여러 개가 붙으므로 **잎 이름만** 칩으로 낸다 — 전체 경로를 다 쓰면
              카드 한 줄이 경로 세 벌로 가득 찬다. 전체는 title 로 확인한다 */}
          {problem.grammar_paths.map((path) => (
            <span
              key={path}
              title={path}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600"
            >
              {parseGrammarPath(path).at(-1) ?? path}
            </span>
          ))}
          {showEditLink && !selectMode && (
            <Link
              href={`/problems/edit/${problem.id}`}
              onClick={stop}
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
          onClick={(e) => { stop(e); onAdd(); }}
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
