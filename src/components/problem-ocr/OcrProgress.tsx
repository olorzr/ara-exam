'use client';

import { AlertTriangle } from 'lucide-react';
import type { OcrRunProgress } from '@/lib/problem-ocr/run';

interface OcrProgressProps {
  progress: OcrRunProgress | null;
  label: string;
  warnings: string[];
}

/**
 * 진행률 막대와 경고 목록.
 *
 * 경고는 접어 두지 않는다 — "읽었다"고만 하고 못 읽은 쪽을 숨기면
 * 선생님이 빠진 문항을 영영 모른다.
 */
export default function OcrProgress({ progress, label, warnings }: OcrProgressProps) {
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
            확인이 필요해요
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-900">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
