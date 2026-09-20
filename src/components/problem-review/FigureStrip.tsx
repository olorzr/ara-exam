'use client';

import { Crop, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_FIGURES } from '@/lib/problem-bank/figure-placeholders';

/**
 * 본문에 끼운 그림들의 미리보기 줄.
 *
 * 검수에서 볼 수 있어야 하는 것은 넷이다: **어떤 그림이 붙었는가**, **몇 번인가**
 * (편집기의 '그림 n' 칩과 짝이다), **잘못 잡힌 것을 어떻게 다시 자르는가**, 그리고 어떻게 빼는가.
 *
 * ⚠️ '다시 자르기' 와 '빼고 다시 붙이기' 는 결과가 다르다. 빼고 붙이면 그림이 **맨 뒤로 가고
 *    번호가 바뀌어** 편집기에서 칩을 도로 옮겨야 한다 — 그래서 자리를 지키는 길을 따로 둔다.
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
  /** 그 자리의 그림을 원본에서 **다시 잡기** 시작한다 (1-based). 없으면 단추를 감춘다 */
  onStartRecapture?: (index: number) => void;
  /** 지금 이 카드가 그림을 받으려고 기다리는 중인가 */
  capturing?: boolean;
  /** 다시 자르려고 기다리는 그림의 순번 (1-based). 새로 붙이는 중이면 null */
  capturingFigure?: number | null;
  /** 이 항목이 '이미지로 출제' 중인가 — 그때는 그림을 고쳐도 인쇄가 안 바뀐다 */
  imageMode?: boolean;
  busy?: boolean;
}

export default function FigureStrip({
  paths, urls, onRemove, onStartCapture, onStartRecapture, capturing, capturingFigure,
  imageMode, busy,
}: FigureStripProps) {
  const full = paths.length >= MAX_FIGURES;
  // ⚠️ '그림 추가' 는 **새로 붙이는 중일 때만** 켜져 보인다. 다시 자르는 중에도 켜 두면
  //    무엇을 기다리는 중인지 화면이 거짓으로 말한다
  const adding = Boolean(capturing) && capturingFigure == null;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">본문 속 그림</span>
        {onStartCapture && (
          <Button
            type="button" variant={adding ? 'default' : 'outline'} size="sm"
            onClick={onStartCapture}
            disabled={busy || full}
            title={full ? `그림은 ${MAX_FIGURES}개까지 붙일 수 있어요` : '원본에서 끌어 잡으세요'}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            <span className="ml-1">{adding ? '원본에서 끌어 잡으세요' : '그림 추가'}</span>
          </Button>
        )}
      </div>

      {/*
        ⚠️ 이미지로 출제하는 항목은 인쇄가 `figure_paths` 가 아니라 통째로 잘라 둔
        `image_path` 를 쓴다 — 그림을 고쳐도 새 문제지에는 안 나간다. 말해 주지 않으면
        '다시 잘랐어요' 만 보고 고쳐진 줄 안다(코덱스 리뷰 2R).
        ⚠️ 그림이 **아직 없을 때도** 띄운다 — 첫 그림을 붙이고 나서야 알면 늦다(3R)
      */}
      {imageMode && (
        <p className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
          이 항목은 <strong>이미지로 출제</strong> 중이라 인쇄에는 잘라 둔 원본 이미지가 나가요.
          그림을 고친 것을 인쇄에 반영하려면 위에서 <strong>글로 출제</strong>로 바꿔 주세요.
        </p>
      )}

      {paths.length === 0 ? (
        <p className="text-[11px] text-gray-400">
          아직 없어요. 그림이 필요하면 왼쪽 원본에서 끌어 잡아 주세요.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {paths.map((path, i) => {
            const src = path ? urls.get(path) : null;
            const waiting = capturingFigure === i + 1;
            return (
              <li
                key={`${path}-${i}`}
                className={`relative rounded${waiting ? ' ring-2 ring-primary ring-offset-1' : ''}`}
              >
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
                {/* 빈 자리('만들지 못했어요')에도 둔다 — 그 자리를 채우는 길이다 */}
                {onStartRecapture && (
                  <button
                    type="button"
                    onClick={() => onStartRecapture(i + 1)}
                    disabled={busy}
                    className={`absolute bottom-0 right-0 flex items-center gap-0.5 rounded-tl px-1 text-[10px] text-white ${
                      waiting ? 'bg-primary' : 'bg-black/60 hover:bg-primary'
                    }`}
                    aria-label={`그림 ${i + 1} 다시 자르기`}
                    title="원본에서 다시 끌어 잡기"
                  >
                    <Crop className="h-3 w-3" />
                    {waiting && <span>끌어 잡으세요</span>}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
