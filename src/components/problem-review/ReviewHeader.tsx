'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { sourceLabel } from '@/lib/problem-bank/source-label';
import SourceTextbookPicker from './SourceTextbookPicker';
import type { ProblemSource } from '@/types/problem-bank';

/**
 * 검수 화면 머리 — 출처 이름·진행 상황·교과서·마치기.
 *
 * 페이지에서 떼어 둔 이유는 길이뿐이다. 상태는 전부 페이지가 들고 있다.
 */

interface ReviewHeaderProps {
  source: ProblemSource;
  problemCount: number;
  verifiedCount: number;
  onTextbook: (textbook: string) => Promise<void>;
  onFinish: () => void;
}

export default function ReviewHeader({
  source, problemCount, verifiedCount, onTextbook, onFinish,
}: ReviewHeaderProps) {
  const textSource = source.ocr_meta?.textSource;

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{source.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <Badge variant="outline">{source.source_type}</Badge>
          {sourceLabel(source)}
          <span>· 문항 {problemCount}개 (검수 {verifiedCount})</span>
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
        <Button type="button" onClick={onFinish} disabled={source.status === '완료'}>
          {source.status === '완료' ? '검수 완료됨' : '검수 마치기'}
        </Button>
      </div>
    </div>
  );
}
