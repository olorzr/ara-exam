'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { facetNodeText } from '@/lib/problem-bank/facet-tree';
import { cn } from '@/lib/utils';

/** 한 단계 들여쓰기(px) — 기출 공유 사이트 트리의 `ul` 들여쓰기와 같은 값 */
export const TREE_INDENT_PX = 14;

interface TreeRowProps {
  depth: number;
  label: string;
  /** 건수 — 있으면 오른쪽 칸에 숫자로 */
  count?: number;
  /** 가지면 펼쳤는가. 잎이면 비운다(화살표 자리만 남는다) */
  expanded?: boolean;
  selected?: boolean;
  /** 0건 — 이름과 숫자를 흐리게(고를 수는 있다) */
  dimmed?: boolean;
  /** 이름 앞에 둘 것 — 여러 개 고르는 트리의 체크 칸 */
  leading?: ReactNode;
  onActivate: () => void;
}

/**
 * 트리 한 줄 — 기출 공유 사이트(exam-share) 문제 찾기 트리와 같은 결(2026-11-14 원장님 "문제은행 구독 시스템의
 * tree 가 디자인도 예뻐, 이것처럼 우리도 해줘").
 *
 * 폴더·문서 그림 없이 작은 화살표 하나, 이름, 오른쪽의 건수 숫자(Jost 굵게)다. 고른 줄은 연한 민트로 칠하고 굵게.
 * 문제 은행 네 트리·작품 전문 트리(`FacetTree`)와 카테고리 트리(`CategoryTree`)가 함께 쓴다 — 두 트리가 예전처럼
 * 모양을 따로 들면 한쪽만 바뀐다.
 *
 * - 이름은 **줄을 바꿔 다 보인다**(말줄임 금지 — 휴대폰·태블릿에서는 title 을 열 길이 없다, 0.9.88 꼬리표와 같은 판단)
 * - 건수가 있으면 줄의 이름(`aria-label`)은 `이름 (n)` 이다 — 숫자 칸만 따로 읽히지 않게
 * - 0건은 흐리지만 숫자 0 이 남아 색만으로 알리지 않는다
 * @param props - 줄 내용과 상태
 * @returns 트리 한 줄
 */
export default function TreeRow({
  depth, label, count, expanded, selected = false, dimmed = false, leading, onActivate,
}: TreeRowProps) {
  const branch = expanded !== undefined;
  const faint = dimmed && !selected;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onActivate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      // 폴더는 접힘·펼침을 알린다 — 화살표는 눈으로만 보이는 표시라 화면 읽기 프로그램은 상태를 모른다
      aria-expanded={branch ? expanded : undefined}
      aria-label={count === undefined ? undefined : facetNodeText({ label, count })}
      data-selected={selected || undefined}
      className={cn(
        'flex w-full cursor-pointer items-center gap-1 rounded-[4px] pr-1.5 text-left text-[13.5px] leading-snug text-ink outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring/40',
        selected ? 'bg-accent-soft font-bold' : 'hover:bg-gray-50',
      )}
      style={{ paddingLeft: depth * TREE_INDENT_PX }}
      onClick={onActivate}
      onKeyDown={onKeyDown}
    >
      <span className="grid h-7 w-[22px] shrink-0 place-content-center text-gray-400" aria-hidden="true">
        {branch && (
          <ChevronRight className={cn('size-3 transition-transform', expanded && 'rotate-90')} strokeWidth={2.25} />
        )}
      </span>
      {leading}
      <span className={cn('min-w-0 flex-1 py-[5px] break-keep [overflow-wrap:anywhere]', faint && 'text-gray-400')}>
        {label}
      </span>
      {count !== undefined && (
        <span className={cn('shrink-0 pl-1 font-tag text-[11.5px] font-bold tabular-nums', faint ? 'text-gray-400' : 'text-ink')}>
          {count.toLocaleString('ko-KR')}
        </span>
      )}
    </div>
  );
}
