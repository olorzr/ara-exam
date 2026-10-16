'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { FileText, Eye } from 'lucide-react';
import { MIN_EXAM_WORDS } from '@/lib/constants';

interface ExamCreatePreviewProps {
  totalQuestions: number;
  passPercentage: number;
  passCount: number;
  creating: boolean;
  /** 지금 고른 카테고리의 단어를 읽는 중인가 — 그동안은 만들 수 없다(옛 선택의 단어가 출제된다) */
  wordsLoading?: boolean;
  /** 지금 고른 카테고리의 단어를 못 읽었는가 */
  wordsFailed?: boolean;
  /** 단어를 다시 읽는다 */
  onRetryWords?: () => void;
  onCreate: () => void;
}

/** 시험지 생성 페이지 오른쪽 미리보기 카드 (문항 수·합격 기준·생성 버튼) */
export default function ExamCreatePreview({
  totalQuestions, passPercentage, passCount, creating, wordsLoading = false, wordsFailed = false,
  onRetryWords, onCreate,
}: ExamCreatePreviewProps) {
  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          미리보기
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-500">총 문항 수</span>
            <span className="font-bold">{totalQuestions}문항</span>
          </div>
          {totalQuestions > 0 && totalQuestions < MIN_EXAM_WORDS && (
            <p className="text-xs text-red-500 text-right">
              최소 {MIN_EXAM_WORDS}문항 필요 (객관식 5지선다 보장)
            </p>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">합격 기준</span>
            <span className="font-bold">{passPercentage}%</span>
          </div>
          <Separator />
          <div className="flex justify-between text-primary">
            <span className="font-medium">통과 기준</span>
            <span className="font-bold">{passCount}개 이상 / {totalQuestions}문항</span>
          </div>
        </div>

        <Separator />

        {wordsFailed && (
          <div className="flex items-center justify-between gap-2 text-xs text-red-600" role="alert">
            <span>단어를 불러오지 못했어요.</span>
            {onRetryWords && (
              <Button type="button" variant="outline" size="sm" onClick={onRetryWords}>다시 시도</Button>
            )}
          </div>
        )}

        <Button
          className="w-full bg-primary hover:bg-primary-hover text-white"
          onClick={onCreate}
          disabled={creating || wordsLoading || wordsFailed || totalQuestions < MIN_EXAM_WORDS}
        >
          <FileText className="h-4 w-4 mr-2" />
          {creating ? '생성 중...' : wordsLoading ? '단어 불러오는 중…' : '시험지 생성'}
        </Button>
      </CardContent>
    </Card>
  );
}
