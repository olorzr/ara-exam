'use client';

import Link from 'next/link';
import { Eye, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sourceMetaLabel } from '@/lib/problem-bank/source-label';
import { examViewHref } from '@/lib/problem-bank/source-set-link';
import { sourceSetOf } from '@/lib/problem-bank/source-sets';
import SourceTextbookPicker from './SourceTextbookPicker';
import type { ProblemSource } from '@/types/problem-bank';
import { PageTitle } from '@/components/magazine';

/**
 * 시험지 화면 머리 — 출처 이름·문항 수·교과서·읽기 전용으로 보기·삭제.
 *
 * '읽기 전용으로 보기' 는 기출 시험지 '세트로 보기' 의 시험 보기로 간다(2026-11-22 한 메뉴로 합치며). 세트로 보는
 * 시험지(내신기출·모의고사 — `sourceSetOf`)만 낸다. 평가문제집 등은 그 화면이 안 그린다.
 *
 * '검수 마치기' 와 검수 수는 2026-09-30 에 걷었다(기출은 원장님이 적재하고 보이는 대로 고친다).
 *
 * 페이지에서 떼어 둔 이유는 길이뿐이다. 상태는 전부 페이지가 들고 있다.
 */

interface ReviewHeaderProps {
  source: ProblemSource;
  problemCount: number;
  onTextbook: (textbook: string) => Promise<void>;
  /**
   * 출처를 통째로 지운다 — 잘못 읽힌 기출을 걷어내는 길. **원장만 넘긴다**(sql/57).
   * 안 넘기면 삭제 단추를 그리지 않는다.
   */
  onDelete?: () => void;
  deleting?: boolean;
}

export default function ReviewHeader({
  source, problemCount, onTextbook, onDelete, deleting = false,
}: ReviewHeaderProps) {
  const textSource = source.ocr_meta?.textSource;
  const viewable = sourceSetOf(source) !== null;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
      <div>
        <PageTitle size="sm">{source.title}</PageTitle>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Badge variant="outline">{source.source_type}</Badge>
          {sourceMetaLabel(source)}
          <span>· 문항 {problemCount}개</span>
          {/*
            PDF 에 박힌 글자를 참고로 썼으면 글자 오독이 적다 — 어디를 얼마나 꼼꼼히 볼지
            가늠하는 데 쓴다. 기출은 대부분 스캔본이라 이 표시가 없는 것이 보통이다.
          */}
          {textSource === 'layer' && <Badge variant="outline">PDF 글자 사용</Badge>}
          {textSource === 'partial' && <Badge variant="outline">PDF 글자 일부 사용</Badge>}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {viewable && (
          <Link
            href={examViewHref(source.id)}
            prefetch={false}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink bg-card px-4 text-sm font-semibold text-ink hover:bg-muted"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            읽기 전용으로 보기
          </Link>
        )}
        {/* 교과서가 있어야 단원 칸이 뜬다 — 여기서 고칠 수 있어야 옛 출처도 분류된다 */}
        <SourceTextbookPicker source={source} onChange={onTextbook} />
        {/* 읽기가 통째로 어긋난 기출은 고치는 것보다 지우고 다시 적재하는 편이 빠르다 */}
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            onClick={onDelete}
            disabled={deleting}
            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            <span className="ml-1">{deleting ? '지우는 중…' : '삭제'}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
