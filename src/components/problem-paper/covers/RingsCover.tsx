import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { ringsScales } from '@/lib/problem-paper/cover-fit';
import { brandLine, courseOrSubject, topicsLine, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BlankField, cssVars } from './parts';

/**
 * B 링 — 흐린 고리 두 개 위에 가운데 정렬한 글 한 줄기(제목 × 단원 · 선생님 · 태그라인 · 과정 · 학생).
 *
 * ⚠️ 시안은 글줄 사이를 margin 으로 쌓아 1,123px 를 거의 다 쓴다 — 중철 면(1,082px)에서는 아래가
 *    잘린다. 그래서 줄 사이를 시안의 간격 비율대로 늘고 주는 빈 칸(`__gap--1~5`)으로 나눈다.
 */
export default function RingsCover(props: CoverLayoutProps) {
  const { title, course, topics, showNameBox, year, teacher } = props;
  const line = topicsLine(topics);
  const scales = ringsScales(props);
  return (
    <div
      className="pb-cover pb-cover--layout pbc-rings"
      style={cssVars({ '--pbc-title-scale': scales.title, '--pbc-topic-scale': scales.topic })}
    >
      <div className="pbc-rings__ring pbc-rings__ring--a" aria-hidden="true" />
      <div className="pbc-rings__ring pbc-rings__ring--b" aria-hidden="true" />

      <div className="pbc-rings__flow">
        <p className="pbc-rings__small">{COVER_COPY.brandKo}</p>
        <div className="pbc-rings__gap pbc-rings__gap--1" />
        <h1 className="pbc-rings__title">{title}</h1>
        <p className="pbc-rings__cross" aria-hidden="true">{COVER_COPY.cross}</p>
        {line && <p className="pbc-rings__topics">{line}</p>}
        <div className="pbc-rings__gap pbc-rings__gap--2" />
        {teacher && <p className="pbc-rings__small pbc-rings__teacher">{`${COVER_COPY.teacherLabel} · ${teacher}`}</p>}
        <div className="pbc-rings__gap pbc-rings__gap--3" />
        <p className="pbc-rings__tagline">{COVER_COPY.ringsTagline}</p>
        <div className="pbc-rings__gap pbc-rings__gap--4" />
        <p className="pbc-rings__small">{courseOrSubject(course)}</p>
        <div className="pbc-rings__gap pbc-rings__gap--5" />
        {showNameBox && (
          <p className="pbc-rings__student"><BlankField label={COVER_COPY.studentLabel} width={200} /></p>
        )}
      </div>

      <span className="pbc-rings__side pbc-rings__side--left" aria-hidden="true">{COVER_COPY.ringsLeft}</span>
      <span className="pbc-rings__side pbc-rings__side--right" aria-hidden="true">{COVER_COPY.ringsRight}</span>

      <p className="pbc-rings__foot">{brandLine(year)}</p>
    </div>
  );
}
