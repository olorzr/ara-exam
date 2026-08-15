'use client';

import { useMemo } from 'react';
import { transformHTML, stripTrailingEmpty } from '@/lib/exam-transform';
import type { TransformMode } from '@/lib/exam-transform';
import { A4Document, CompactPageHeader } from '@/components/print';
import { useConceptSheetBlocks } from '@/hooks/useConceptSheetBlocks';
import type { BuilderCategory } from './ExamCategoryBar';

/** 1단 최대 글자 수 — 초과 시 2단 레이아웃 */
const SINGLE_COL_CHAR_THRESHOLD = 300;

/** 시트 설정 */
export interface SheetConfig {
  badge: string;
  badgeClass: string;
  mode: TransformMode;
  showScore: boolean;
  /** 2페이지 이후 헤더 구분선 색 계열 */
  accent: 'mint' | 'pink';
}

/** 모든 탭별 설정 */
export const SHEET_CONFIGS: Record<string, SheetConfig> = {
  concept: { badge: '개념지', badgeClass: 'bg-[#E8F8F5] text-[#5BBFB7]', mode: 'concept-interactive', showScore: false, accent: 'mint' },
  stage1:  { badge: '1단계: 초성', badgeClass: 'bg-[#B8EDE8] text-[#5BBFB7]', mode: 'stage1', showScore: true, accent: 'mint' },
  stage2:  { badge: '2단계: 글자 수', badgeClass: 'bg-[#FDF0F4] text-[#C83C6E]', mode: 'stage2', showScore: true, accent: 'pink' },
  stage3:  { badge: '3단계: 빈칸', badgeClass: 'bg-[#FDF0F4] text-[#8B1A4A]', mode: 'stage3', showScore: true, accent: 'pink' },
  answer:  { badge: '답안지', badgeClass: 'bg-[#F5C6D8] text-[#8B1A4A]', mode: 'answer', showScore: false, accent: 'pink' },
};

interface ExamSheetRendererProps {
  editorHTML: string;
  config: SheetConfig;
  category: BuilderCategory;
  markCount: number;
  /** 개념지 탭에서 인터랙티브 모드 */
  interactive?: boolean;
  /** '전체 출력' 에서 다음 시트를 새 페이지에서 시작시킨다 */
  breakAfterLast?: boolean;
}

/**
 * 개념지·단계별 시트 렌더러.
 * 본문 HTML 을 최상위 요소 단위 블록으로 쪼개 A4 낱장에 실측 배치한다.
 */
export default function ExamSheetRenderer({
  editorHTML,
  config,
  category,
  markCount,
  interactive,
  breakAfterLast,
}: ExamSheetRendererProps) {
  const year = new Date().getFullYear();
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const unitText = category.subunit ? `${category.unit} — ${category.subunit}` : category.unit;
  const title = [`${year} ${category.grade} 국어 ${category.publisher}`, unitText].filter(Boolean).join(' ');

  const bodyHTML = useMemo(
    () => transformHTML(stripTrailingEmpty(editorHTML), config.mode),
    [editorHTML, config.mode],
  );

  /** HTML 태그 제거 후 글자 수로 2단 여부 판단 */
  const useDualCol = useMemo(() => {
    const textLength = editorHTML.replace(/<[^>]*>/g, '').trim().length;
    return textLength > SINGLE_COL_CHAR_THRESHOLD;
  }, [editorHTML]);

  const { blocks, handleOversized } = useConceptSheetBlocks(bodyHTML);

  const renderedBlocks = blocks.map((html, i) => (
    <div key={i} className="sheet-body" dangerouslySetInnerHTML={{ __html: html }} />
  ));

  return (
    <A4Document
      blocks={renderedBlocks}
      columns={useDualCol ? 2 : 1}
      remeasureKey={`${config.mode}|${bodyHTML.length}|${blocks.length}`}
      onOversized={handleOversized}
      breakAfterLast={breakAfterLast}
      className={`eb-sheet-table ${interactive ? 'eb-concept-interactive' : ''}`.trim()}
      firstPageHeader={
        <>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-[14pt] font-extrabold text-gray-900 leading-tight">
                {title}
                <span className={`inline-block ml-2 px-2 py-0.5 rounded text-[9pt] font-bold ${config.badgeClass}`}>
                  {config.badge}
                </span>
              </h2>
              <p className="text-[8pt] text-gray-400 mt-0.5 tracking-widest">아라국어논술</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="아라국어논술" width={48} height={48} className="object-contain" />
          </div>

          <div className="border-t-[1.5px] border-b-[1.5px] border-[#B8EDE8] py-2 mb-3">
            <div className="flex items-center gap-6 text-[10pt] text-gray-600">
              <span className="font-semibold">
                이름 <span className="inline-block border-b border-gray-400 w-28 ml-2" />
              </span>
              <span>
                날짜 <span className="ml-1 text-gray-800">{today}</span>
              </span>
              {config.showScore && (
                <span className="ml-auto font-semibold text-[#C83C6E]">
                  <span className="inline-block border-b border-gray-400 w-10 text-center" /> / {markCount}개
                </span>
              )}
            </div>
            {(unitText || category.semester) && (
              <div className="flex justify-between text-[9pt] text-gray-500 mt-1">
                <span className="text-gray-800 font-medium">{unitText}</span>
                <span>{category.semester}</span>
              </div>
            )}
          </div>
        </>
      }
      laterPageHeader={<CompactPageHeader title={`${title} · ${config.badge}`} accent={config.accent} />}
    />
  );
}
