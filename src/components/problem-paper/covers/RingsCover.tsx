import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { ringsTitleScale } from '@/lib/problem-paper/cover-fit';
import type { CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BlankField, cssVars } from './parts';

/**
 * B 링 — 흐린 고리 두 개 위에 가운데 정렬한 글 한 줄기.
 *
 * ⚠️ 시안은 글줄 사이를 margin 으로 쌓아 1,123px 를 거의 다 쓴다 — 중철 면(1,082px)에서는 아래가
 *    잘린다. 그래서 줄 사이를 시안의 간격 비율대로 늘고 주는 빈 칸(`__gap--1~5`)으로 나눈다.
 */
export default function RingsCover({ title, course, topics, showNameBox, year }: CoverLayoutProps) {
  return (
    <div
      className="pb-cover pb-cover--layout pbc-rings"
      style={cssVars({ '--pbc-title-scale': ringsTitleScale(title) })}
    >
      <div className="pbc-rings__ring pbc-rings__ring--a" aria-hidden="true" />
      <div className="pbc-rings__ring pbc-rings__ring--b" aria-hidden="true" />

      <div className="pbc-rings__flow">
        <p className="pbc-rings__small">{COVER_COPY.ringsHead}</p>
        <div className="pbc-rings__gap pbc-rings__gap--1" />
        <h1 className="pbc-rings__title">{title}</h1>
        <div className="pbc-rings__gap pbc-rings__gap--2" />
        {course && <p className="pbc-rings__small">{course}</p>}
        <div className="pbc-rings__gap pbc-rings__gap--3" />
        <p className="pbc-rings__tagline">{COVER_COPY.ringsTagline}</p>
        <div className="pbc-rings__gap pbc-rings__gap--4" />
        {topics.length > 0 && <p className="pbc-rings__small pbc-rings__topics">{topics.join(' · ')}</p>}
        <div className="pbc-rings__gap pbc-rings__gap--5" />
        {year && <p className="pbc-rings__year">{year}</p>}
      </div>

      <span className="pbc-rings__side pbc-rings__side--left" aria-hidden="true">{COVER_COPY.ringsLeft}</span>
      <span className="pbc-rings__side pbc-rings__side--right" aria-hidden="true">{COVER_COPY.ringsRight}</span>

      <div className="pbc-rings__foot">
        <div className="pbc-rings__fields">
          {showNameBox && (
            <>
              <BlankField label={COVER_COPY.nameLabel} size="lg" />
              <BlankField label={COVER_COPY.dateLabel} size="sm" />
            </>
          )}
        </div>
        <span className="pbc-rings__brand">
          {year ? `${COVER_COPY.brandEn} · ${year}` : COVER_COPY.brandEn}
        </span>
      </div>
    </div>
  );
}
