'use client';

import Link from 'next/link';
import { Pencil, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { unitKey, unitLabel } from '@/lib/reference-texts/units';
import type { ReferenceText } from '@/types/reference-text';
import ReferenceBodyView from './ReferenceBodyView';

interface ReferenceTextViewProps {
  row: ReferenceText;
  /** 목록 경로 */
  backHref: string;
  /** 원장이면 '편집' 단추를 보여 준다 — 없으면 단추를 그리지 않는다(눌리는데 조용한 단추를 두지 않는다) */
  onEdit?: () => void;
}

/**
 * 이 화면을 인쇄할 때의 쪽 여백 — 전역 `@page`(print-a4.css)는 A4 엔진 문서를 위해 여백 0 이라, 두 쪽을 넘는 개념 정리는
 * 둘째 쪽부터 글이 종이 끝에 붙는다. 같은 특이성의 `@page` 는 나중 것이 이기므로 본문 안 `<style>` 로 덮는다
 * (문제지 중철 `BookletStack` 과 같은 수법 — 이 화면에만 걸린다).
 */
const PRINT_PAGE_STYLE = '@media print { @page { size: A4 portrait; margin: 14mm 16mm; } }';

/**
 * 작품 전문 · 개념 한 편의 **보기 쪽** — 선생님은 늘 이 화면, 원장은 여기서 '편집' 으로 넘어간다.
 *
 * 머리(종류 · 차례 · 제목 · 지은이 · 단원 · 태그 · 판본 메모) + 문제집처럼 꾸민 본문(`ReferenceBodyView`).
 * '인쇄' 는 브라우저 인쇄다(A4 엔진이 아니다) — 단추 줄은 `data-no-print`, 쪽 여백은 `PRINT_PAGE_STYLE`.
 * @param props - 행 · 목록 경로 · 편집 콜백
 * @returns 보기 쪽
 */
export default function ReferenceTextView({ row, backHref, onEdit }: ReferenceTextViewProps) {
  const concept = row.kind === '개념';
  return (
    <article className="ref-page mx-auto max-w-4xl space-y-4">
      <style data-reference-page>{PRINT_PAGE_STYLE}</style>
      <div className="flex flex-wrap items-center justify-end gap-2" data-no-print>
        <Link href={backHref}>
          <Button type="button" variant="outline" size="sm">목록</Button>
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 h-4 w-4" />
          인쇄
        </Button>
        {onEdit && (
          <Button type="button" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            편집
          </Button>
        )}
      </div>

      {/* ⚠️ `<header>` 로 쓰지 않는다 — 전역 인쇄 규칙(print-a4.css)이 header 를 통째로 숨겨 인쇄물에서 제목이 빠진다 */}
      <div className="space-y-2 border-b border-gray-200 pb-4">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded px-1.5 py-0.5 font-medium ${concept ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
            {concept ? '개념 정리' : '작품 전문'}
          </span>
          {row.seq !== null && <span className="text-gray-400">#{row.seq}</span>}
          {row.tags.map((tag) => (
            <span key={`tag:${tag}`} className="rounded border border-primary/30 px-1.5 py-0.5 text-primary">#{tag}</span>
          ))}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          {row.title}
          {row.author && <span className="ml-2 text-base font-normal text-gray-500">{row.author}</span>}
        </h1>
        {row.note && <p className="text-sm text-amber-700">{row.note}</p>}
        {(row.units.length > 0 || row.grammar_paths.length > 0) && (
          <ul className="flex flex-wrap gap-1" aria-label="실린 교과서 단원과 문법">
            {row.units.map((unit) => (
              <li key={unitKey(unit)} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{unitLabel(unit)}</li>
            ))}
            {row.grammar_paths.map((path) => (
              <li key={`g:${path}`} className="rounded bg-teal-50 px-1.5 py-0.5 text-xs text-teal-700">{path}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="ref-page__body rounded-xl border border-gray-200 bg-white px-5 py-6 sm:px-9">
        <ReferenceBodyView body={row.body} format={row.format} kind={row.kind} />
      </div>
    </article>
  );
}
