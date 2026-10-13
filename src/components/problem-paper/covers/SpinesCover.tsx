import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import {
  spinesCourseLines, spinesCourseScale, spinesHeadScale, spinesTitleScales, spinesTopicScale,
} from '@/lib/problem-paper/cover-fit-spines';
import type { CoverLayoutProps } from '@/lib/problem-paper/cover-text';
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
    { n: 3, text: year ? `${COVER_COPY.brandEn} · ${year}` : COVER_COPY.brandEn },
    { n: 4, lines: courseLines, labelScale: spinesCourseScale(courseLines) },
    { n: 5, text: COVER_COPY.spinesTagline },
    { n: 6, text: title, scale: scales.wide },
    { n: 7, text: COVER_COPY.spinesRepeat },
    { n: 8, text: COVER_COPY.brandKo },
    { n: 9, text: year || 'ARA' },
  ];
}

/**
 * C 책등 — 위에 단원 목록, 아래에 책등 아홉 권. 제목은 세로 책등 셋에 들어간다.
 *
 * 세로 책등은 폭·높이가 고정이라 긴 제목은 세로줄을 늘리고 글자를 줄여 칸 안에 담는다(잘라 내지 않는다,
 * `spinesTitleScales`). 가로로 읽히는 제목은 머리 줄에 한 번 더 있다. 단원 목록도 책장을 덮지 않게 줄인다.
 */
export default function SpinesCover(props: CoverLayoutProps) {
  const { title, course, topics, showNameBox, year } = props;
  return (
    <div className="pb-cover pb-cover--layout pbc-spines" style={cssVars({ '--pbc-head-scale': spinesHeadScale(props) })}>
      <div className="pbc-spines__head">
        <span>{COVER_COPY.paperSize}</span>
        <h1 className="pbc-spines__head-title">{`${title} — ${COVER_COPY.sheet}`}</h1>
        <span>{year}</span>
      </div>

      <div className="pbc-spines__info">
        <span>{course ? `${COVER_COPY.brandKo} · ${course}` : COVER_COPY.brandKo}</span>
        {showNameBox && (
          <span className="pbc-spines__fields">
            <BlankField label={COVER_COPY.nameLabel} size="md" />
            <BlankField label={COVER_COPY.dateLabel} size="sm" />
          </span>
        )}
      </div>

      {topics.length > 0 && (
        <ol
          className="pbc-spines__list"
          style={cssVars({ '--pbc-topic-scale': spinesTopicScale(props) })}
        >
          {topics.map((topic, i) => (
            <li key={`${i}-${topic}`} className="pbc-spines__item">
              <span className="pbc-spines__item-name">{topic}</span>
              <span className="pbc-spines__item-no">{String(i + 1).padStart(2, '0')}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="pbc-spines__shelf" aria-hidden="true">
        {shelf(props).map((spine) => (
          <div
            key={spine.n}
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
        ))}
      </div>
    </div>
  );
}
