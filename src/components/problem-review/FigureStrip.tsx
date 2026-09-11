'use client';

import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_FIGURES } from '@/lib/problem-bank/figure-placeholders';

/**
 * 본문에 끼운 그림들의 미리보기 줄.
 *
 * 검수에서 볼 수 있어야 하는 것은 셋이다: **어떤 그림이 붙었는가**, **몇 번인가**
 * (편집기의 '그림 n' 칩과 짝이다), **잘못 잡힌 것을 어떻게 빼는가**.
 *
 * ⚠️ 자리를 못 만든 그림(빈 경로)도 **자리를 지켜 보여 준다.** 빼 버리면 뒤 그림의
 *    번호가 당겨져 본문 자리표시자가 엉뚱한 그림을 가리킨다.
 */

interface FigureStripProps {
  paths: readonly string[];
  /** Storage 경로 → 서명 URL */
  urls: Map<string, string>;
  /** 그림 하나를 뺀다 (1-based) */
  onRemove: (index: number) => void;
  /** 원본에서 끌어 잡아 새 그림을 붙이기 시작한다. 없으면 단추를 감춘다 */
  onStartCapture?: () => void;
  /** 지금 이 카드가 그림을 받으려고 기다리는 중인가 */
  capturing?: boolean;
  busy?: boolean;
}

export default function FigureStrip({
  paths, urls, onRemove, onStartCapture, capturing, busy,
}: FigureStripProps) {
  const full = paths.length >= MAX_FIGURES;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">본문 속 그림</span>
        {onStartCapture && (
          <Button
            type="button" variant={capturing ? 'default' : 'outline'} size="sm"
            onClick={onStartCapture}
            disabled={busy || full}
            title={full ? `그림은 ${MAX_FIGURES}개까지 붙일 수 있어요` : '원본에서 끌어 잡으세요'}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span className="ml-1">{capturing ? '원본에서 끌어 잡으세요' : '그림 추가'}</span>
          </Button>
        )}
      </div>

      {paths.length === 0 ? (
        <p className="text-[11px] text-gray-400">
          아직 없어요. 그림이 필요하면 왼쪽 원본에서 끌어 잡아 주세요.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {paths.map((path, i) => {
            const src = path ? urls.get(path) : null;
            return (
              <li key={`${path}-${i}`} className="relative">
                <span className="absolute left-0 top-0 z-10 rounded-br bg-black/60 px-1 text-[10px] text-white">
                  {i + 1}
                </span>
                {src ? (
                  // 서명 URL 이라 next/image 로 다룰 수 없다
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt={`그림 ${i + 1}`}
                    className="h-20 w-auto rounded border border-gray-200 bg-white object-contain"
                  />
                ) : (
                  <span className="flex h-20 w-24 items-center justify-center rounded border border-dashed border-amber-400 px-1 text-center text-[10px] text-amber-700">
                    {path ? '불러오지 못했어요' : '만들지 못했어요'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(i + 1)}
                  disabled={busy}
                  className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-[10px] text-white hover:bg-red-600"
                  aria-label={`그림 ${i + 1} 빼기`}
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
