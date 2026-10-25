import type { ReactNode } from 'react';
import type { PaperCoverLayout } from '@/lib/problem-paper/cover';
import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { brandLine } from '@/lib/problem-paper/cover-text';
import { SketchStars, SketchWave } from './SketchDoodles';
import { ZineBlob, ZineBox2 } from './ZineDoodles';

/** 디자인 뒷표지가 받는 값 */
export interface BackCoverProps {
  /** 앞표지 디자인 — 그 디자인의 글꼴·꾸밈을 조금 쓴다 */
  layout: PaperCoverLayout;
  /** 문제지를 만든 해. 모르면 '' */
  year: string;
}

/**
 * 디자인마다 뒷표지 꾸밈 — 앞표지의 CSS 조각을 그대로 빌려 쓴다(자리만 back.css 가 옮긴다).
 * `Record` 라 디자인을 더하면 여기가 빠졌을 때 빌드가 깨진다.
 */
function decor(layout: PaperCoverLayout, year: string): ReactNode {
  const parts: Record<PaperCoverLayout, () => ReactNode> = {
    basic: () => <span className="pb-cover__accent pbc-back__accent" />,
    editorial: () => (
      <div className="pbc-editorial__head pbc-back__head">
        <span>{COVER_COPY.brandKo}</span>
        <span>{COVER_COPY.sheet}</span>
        <span>{year}</span>
      </div>
    ),
    rings: () => <div className="pbc-rings__ring pbc-back__ring" />,
    spines: () => (
      <div className="pbc-back__shelf">
        <div className="pbc-spines__spine pbc-spines__spine--3"><span>{brandLine(year)}</span></div>
        <div className="pbc-spines__spine pbc-spines__spine--7"><span>{COVER_COPY.spinesRepeat}</span></div>
        <div className="pbc-spines__spine pbc-spines__spine--9"><span>{year || COVER_COPY.brandShort}</span></div>
      </div>
    ),
    soft: () => (
      <>
        <div className="pbc-soft__blob pbc-soft__blob--a" />
        <div className="pbc-soft__blob pbc-soft__blob--c" />
        <div className="pbc-soft__dot pbc-soft__dot--c" />
      </>
    ),
    sketch: () => (
      <>
        <div className="pbc-sketch__frame" />
        <SketchStars />
        <SketchWave />
      </>
    ),
    zine: () => (
      <>
        <div className="pbc-zine__box pbc-back__zine-box"><ZineBox2 /></div>
        <div className="pbc-zine__circle pbc-back__zine-circle"><ZineBlob /></div>
      </>
    ),
  };
  return parts[layout]();
}

/**
 * 디자인 뒷표지 — 앞표지 디자인의 짝. 상표 · 과목 · 저작권 안내 · 연도를 아래쪽에 모으고, 위쪽에는 그 디자인의
 * 꾸밈을 조금 둔다(사용자 결정 2026-10-25). 클로드 디자인 캔버스에는 뒷표지 아트보드가 없어 앞표지의 조각으로 짰다.
 *
 * ⚠️ 뿌리에 높이를 쓰지 않고 글 묶음은 `bottom` 기준이다 — 중철 면(A4 − 40px)에서도 잘리지 않는다(앞표지와 같은 규약).
 */
export default function BackCover({ layout, year }: BackCoverProps) {
  const mark = [COVER_COPY.copyrightMark, year, COVER_COPY.brandKo].filter(Boolean).join(' ');
  return (
    <div className={`pb-cover pb-cover--layout pbc-back pbc-back--${layout}`}>
      <div className="pbc-back__decor" aria-hidden="true">{decor(layout, year)}</div>
      <div className="pbc-back__text">
        <p className="pbc-back__brand">{COVER_COPY.brandKo}</p>
        <p className="pbc-back__subject">{COVER_COPY.subject}</p>
        <p className="pbc-back__copyright">{COVER_COPY.copyright}</p>
        <p className="pbc-back__note">{COVER_COPY.note}</p>
        <p className="pbc-back__mark">{mark}</p>
      </div>
    </div>
  );
}
