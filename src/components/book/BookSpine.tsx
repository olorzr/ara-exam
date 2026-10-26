import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import {
  MIN_SPINE_TEXT_MM, spineFontFamily, spineInkFor, spineTypeSize, type SpineFont,
} from '@/lib/book';

interface BookSpineProps {
  /** 책등 왼쪽 끝(펼침면 기준 mm) */
  leftMm: number;
  /** 책등 폭(mm) */
  widthMm: number;
  /** 바탕색 `#rrggbb` */
  color: string;
  /** 위쪽 제목(판 이름까지 붙은 값) */
  title: string;
  /** 위쪽 제목 글꼴(고른 값). 아래쪽 학원 이름은 늘 지마켓 산스 Bold(book-cover.css) */
  font: SpineFont;
}

/**
 * 책등 — **단색 바탕 + 세로 글자**(사용자 결정 2026-10-25 "화려하지 않아도 됨, 단색에 글자만").
 *
 * 위아래 재단 여백까지 색을 칠하고, 위쪽에 제목·아래쪽에 학원 이름을 세로로 찍는다. 글자 크기는 책등 폭에서
 * 출발해 세로 자리에 다 들어가도록 줄인다(`spineTypeSize` — 잘라 내지 않는다). 글자색은 바탕과 대비가 큰 쪽이다.
 * 책등이 `MIN_SPINE_TEXT_MM` 보다 얇으면 글자를 찍지 않는다(재단 오차로 앞·뒤표지에 걸친다).
 * 제목 글꼴은 고른 값을 인라인으로 주고(2026-10-26), 학원 이름은 학원 로고 글꼴로 고정이다.
 */
export default function BookSpine({ leftMm, widthMm, color, title, font }: BookSpineProps) {
  const showText = widthMm >= MIN_SPINE_TEXT_MM;
  const size = spineTypeSize(title, COVER_COPY.brandKo, widthMm, font.sizeScale);
  return (
    <div
      className="book-cover__spine"
      data-spine-mm={widthMm}
      style={{ left: `${leftMm}mm`, width: `${widthMm}mm`, background: color, color: spineInkFor(color) }}
    >
      {showText && (
        <div className="book-spine">
          <span
            className="book-spine__title"
            style={{ fontSize: `${size.titlePx}px`, fontFamily: spineFontFamily(font), fontWeight: font.weight }}
          >
            {title}
          </span>
          <span className="book-spine__brand" style={{ fontSize: `${size.brandPx}px` }}>{COVER_COPY.brandKo}</span>
        </div>
      )}
    </div>
  );
}
