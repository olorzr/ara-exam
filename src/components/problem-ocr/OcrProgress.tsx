'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { OcrRunProgress } from '@/lib/problem-ocr/run';
import { toWarningObject, warningKey, type OcrWarning, type OcrWarningTarget } from '@/lib/problem-ocr/warnings';

interface OcrProgressProps {
  progress: OcrRunProgress | null;
  label: string;
  warnings: OcrWarning[];
  /** 대상을 누르면 그 항목으로 데려간다 (검수 화면). 없으면 이름만 보여 준다 */
  onTarget?: (target: OcrWarningTarget) => void;
  /** 다른 화면으로 보내야 할 때 쓸 링크 (업로드 화면 → 검수 화면) */
  targetHref?: (target: OcrWarningTarget) => string | null;
}

/**
 * 진행률 막대와 경고 목록.
 *
 * 경고는 접어 두지 않는다 — "읽었다"고만 하고 못 읽은 쪽을 숨기면
 * 선생님이 빠진 문항을 영영 모른다.
 *
 * 경고마다 **어느 항목 얘기인지**를 칩으로 붙인다. 예전에는 메시지에 `Q3:` 같은
 * 묶음 지역 이름이 박혀 있었는데 화면 어디에도 그런 이름이 없어서, 무엇이 잘못됐는지는
 * 알아도 **어디를 고쳐야 하는지는 알 수 없었다.**
 */
export default function OcrProgress({
  progress, label, warnings, onTarget, targetHref,
}: OcrProgressProps) {
  const percent = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-3">
      {progress && (
        <div>
          <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
            <span>{label}</span>
            <span>{percent}%</span>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded bg-gray-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={label}
          >
            <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            확인이 필요해요 ({warnings.length})
          </p>
          <ul className="mt-1 space-y-1.5 text-sm text-amber-900">
            {warnings.map((warning, i) => {
              const { message, targets } = toWarningObject(warning);
              return (
                // 같은 말이 대상만 다르게 여러 번 올 수 있어 자리 번호를 함께 쓴다
                <li key={`${warningKey(warning)}:${i}`} className="flex flex-wrap items-baseline gap-1.5">
                  <span>{message}</span>
                  {targets?.map((target, j) => (
                    <TargetChip
                      key={`${target.kind}:${target.id ?? target.page ?? j}`}
                      target={target}
                      onTarget={onTarget}
                      href={targetHref?.(target) ?? null}
                    />
                  ))}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** 경고가 가리키는 항목 하나 — 누를 수 있으면 버튼, 아니면 이름표 */
function TargetChip({
  target, onTarget, href,
}: {
  target: OcrWarningTarget;
  onTarget?: (target: OcrWarningTarget) => void;
  href: string | null;
}) {
  const className = 'rounded border border-amber-300 bg-white px-1.5 py-0.5 text-xs font-medium text-amber-900';

  if (onTarget) {
    return (
      <button
        type="button"
        onClick={() => onTarget(target)}
        className={`${className} hover:bg-amber-100`}
        aria-label={`${target.label}(으)로 이동`}
      >
        {target.label}
      </button>
    );
  }
  if (href) {
    return <Link href={href} className={`${className} hover:bg-amber-100`}>{target.label}</Link>;
  }
  return <span className={className}>{target.label}</span>;
}
