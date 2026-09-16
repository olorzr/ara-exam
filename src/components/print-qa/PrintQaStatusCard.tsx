'use client';

import { AlertTriangle, RefreshCw, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { QaAnswerCounts } from '@/lib/print-qa';

/**
 * 문답 시험지의 **지금 상태**와 나누기 단추.
 *
 * ⚠️ 원문이 다시 읽혀 문답이 옛것이 됐을 때 **지우지 않고 알린다.** 선생님이 손으로 고친 답과
 *    만들어 둔 모범답안이 거기 들어 있어, 말없이 버리면 그 값을 다시 치러야 한다.
 *    다시 나눌지는 사람이 정한다.
 */

interface PrintQaStatusCardProps {
  counts: QaAnswerCounts;
  /** 나눠 둔 문답이 지금 원문과 어긋나는가 */
  stale: boolean;
  /** 문답 프린트로 보이는가 — 아직 안 나눴을 때의 권유 문구를 가른다 */
  looksLikeQa: boolean;
  running: boolean;
  /** 저장이 도는 중인가 — AI 와 저장은 한 잠금이다(서로 덮지 않게) */
  saving: boolean;
  aiEnabled: boolean;
  /** 나누기가 남긴 경고 */
  warnings: string[];
  onSplit: () => void;
  onCancel: () => void;
}

/**
 * 상태 카드를 그린다.
 * @param props - 세어 둔 값·상태와 나누기·취소 콜백
 * @returns 카드
 */
export default function PrintQaStatusCard({
  counts, stale, looksLikeQa, running, saving, aiEnabled, warnings, onSplit, onCancel,
}: PrintQaStatusCardProps) {
  const empty = counts.total === 0;

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-700">
              {empty ? (
                looksLikeQa
                  ? '이 프린트는 물음과 답이 적혀 있는 것 같아요. 문답으로 나눠 보세요.'
                  : '아직 문답으로 나누지 않았어요.'
              ) : (
                <>
                  문항 <b className="text-gray-900">{counts.total}개</b>
                  {counts.none > 0 && ` · 답 없음 ${counts.none}개`}
                  {counts.handwritten > 0 && ` · 학생 손글씨 ${counts.handwritten}개`}
                  {counts.ai > 0 && ` · AI 모범답안 ${counts.ai}개`}
                </>
              )}
            </p>
            {!empty && (counts.unverified > 0 || counts.withoutEvidence > 0) && (
              <p className="mt-0.5 text-xs text-amber-700">
                {counts.unverified > 0 && `원문과 다른 물음 ${counts.unverified}개`}
                {counts.unverified > 0 && counts.withoutEvidence > 0 && ' · '}
                {counts.withoutEvidence > 0 && `근거를 못 찾은 답 ${counts.withoutEvidence}개`}
                {' — 원본과 대조해 확인해 주세요.'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {running ? (
              <Button type="button" variant="outline" size="sm" onClick={onCancel}>취소</Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant={empty ? 'default' : 'outline'}
                className={empty ? 'bg-primary text-white hover:bg-primary-hover' : undefined}
                disabled={!aiEnabled || saving}
                title={aiEnabled ? undefined : 'ChatGPT 연결이 필요해요'}
                onClick={onSplit}
              >
                {empty
                  ? <Wand2 className="mr-1 h-3.5 w-3.5" />
                  : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
                {empty ? '문답으로 나누기' : '다시 나누기'}
              </Button>
            )}
          </div>
        </div>

        {stale && (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              이 문답을 나눈 뒤에 프린트를 <b>다시 읽었어요.</b> 지금 원문과 다를 수 있습니다 —
              원본과 맞춰 보시고, 필요하면 다시 나눠 주세요.
              (다시 나누면 손으로 고친 답과 모범답안은 사라집니다.)
            </span>
          </p>
        )}

        {warnings.length > 0 && (
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-1.5 text-xs text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
