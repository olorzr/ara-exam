'use client';

import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sourceMetaLabel } from '@/lib/problem-bank/source-label';
import SourceTextbookPicker from './SourceTextbookPicker';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 시험지 화면 머리 — 출처 이름·문항 수·교과서·삭제.
 *
 * '검수 마치기' 와 검수 수는 2026-09-30 에 걷었다(기출은 원장님이 적재하고 보이는 대로 고친다).
 *
 * 페이지에서 떼어 둔 이유는 길이뿐이다. 상태는 전부 페이지가 들고 있다.
 */

interface ReviewHeaderProps {
  source: ProblemSource;
  problemCount: number;
  onTextbook: (textbook: string) => Promise<void>;
  /** 출처를 통째로 지운다 — 잘못 읽힌 기출을 검수 중에 걷어내는 길 */
  onDelete: () => void;
  deleting: boolean;
}

export default function ReviewHeader({
  source, problemCount, onTextbook, onDelete, deleting,
}: ReviewHeaderProps) {
  const textSource = source.ocr_meta?.textSource;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{source.title}</h1>
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
      <div className="flex items-end gap-3">
        {/* 교과서가 있어야 단원 칸이 뜬다 — 여기서 고칠 수 있어야 옛 출처도 분류된다 */}
        <SourceTextbookPicker source={source} onChange={onTextbook} />
        {/* 읽기가 통째로 어긋난 기출은 고치는 것보다 지우고 다시 적재하는 편이 빠르다 */}
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
      </div>
    </div>
  );
}
