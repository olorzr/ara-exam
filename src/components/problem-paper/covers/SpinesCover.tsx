import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import {
  spinesBodyScale, spinesCourseLines, spinesCourseScale, spinesTeacherText, spinesTitleScales,
} from '@/lib/problem-paper/cover-fit-spines';
import { brandLine, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BlankField, cssVars } from './parts';

interface Spine {
  /** spines.css 의 `pbc-spines__spine--N` — 시안의 아홉 책등 차례 */
  n: number;
  text?: string;
  /** 세로로 흐르는 책등만 배율을 받는다(제목 책등) */
  scale?: number;
  /** 가로 글 상자를 담는 책등(과정) */
  lines?: string[];
  /** 과정 상자의 글 배율 */
  labelScale?: number;
}

function shelf({ title, course, year }: CoverLayoutProps): Spine[] {
  const scales = spinesTitleScales(title);
  const courseLines = spinesCourseLines(course);
  return [
    { n: 1, text: title, scale: scales.thin },
    { n: 2, text: title, scale: scales.bold },
    { n: 3, text: brandLine(year) },
    { n: 4, lines: courseLines, labelScale: spinesCourseScale(courseLines) },
    { n: 5, text: COVER_COPY.ringsTagline },
    { n: 6, text: title, scale: scales.wide },
    { n: 7, text: COVER_COPY.spinesRepeat },
    { n: 8, text: COVER_COPY.brandKo },
    { n: 9, text: year || COVER_COPY.brandShort },
  ];
}

/**
 * 책장 한 칸 — 세로 글이거나 과정 상자다.
 * @param props.spine - 책등 하나
 */
function SpineBook({ spine }: { spine: Spine }) {
  return (
    <div
      className={`pbc-spines__spine pbc-spines__spine--${spine.n}`}
      style={spine.scale === undefined ? undefined : cssVars({ '--pbc-spine-scale': spine.scale })}
    >
      {spine.lines ? (
        <span className="pbc-spines__label" style={cssVars({ '--pbc-label-scale': spine.labelScale ?? 1 })}>
          {spine.lines.map((line, i) => <span key={`${i}-${line}`}>{line}</span>)}
        </span>
      ) : (
        <span className="pbc-spines__text">{spine.text}</span>
      )}
    </div>
  );
}

/**
 * C 책등 — 머리 · 선생님/학생 줄 · 오른쪽 정렬 제목과 단원 번호 목록 · 아래 책등 아홉 권.
 *
 * 세로 책등은 폭·높이가 고정이라 긴 제목은 세로줄을 늘리고 글자를 줄여 칸 안에 담는다(잘라 내지 않는다,
 * `spinesTitleScales`). 본문 제목과 단원 목록은 책장을 덮지 않게 함께 줄인다(`spinesBodyScale`).
 */
export default function SpinesCover(props: CoverLayoutProps) {
  const { title, topics, showNameBox, year, teacher } = props;
  const body = spinesBodyScale(props);
  return (
    <div
      className="pb-cover pb-cover--layout pbc-spines"
      style={cssVars({ '--pbc-title-scale': body.title, '--pbc-topic-scale': body.topic })}
    >
      <div className="pbc-spines__head">
        <span>{COVER_COPY.brandShort}</span>
        <span className="pbc-spines__head-mid">{COVER_COPY.spinesHead}</span>
        <span>{year}</span>
      </div>

      <div className="pbc-spines__info">
        <span className="pbc-spines__teacher">{spinesTeacherText(teacher)}</span>
        {showNameBox && <BlankField label={COVER_COPY.studentLabel} width={150} className="pbc-spines__student" />}
      </div>

      <div className="pbc-spines__body">
        <h1 className="pbc-spines__title">{title}</h1>
        {topics.length > 0 && (
          <ol className="pbc-spines__list">
            {topics.map((topic, i) => (
              <li key={`${i}-${topic}`} className="pbc-spines__item">
                <span className="pbc-spines__item-name">{topic}</span>
                <span className="pbc-spines__item-no">{String(i + 1).padStart(2, '0')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="pbc-spines__shelf" aria-hidden="true">
        {shelf(props).map((spine) => <SpineBook key={spine.n} spine={spine} />)}
      </div>
    </div>
  );
}
