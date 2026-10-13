import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import {
  sketchGridTopics, sketchKicker, sketchTitleScale, sketchTopicScale,
} from '@/lib/problem-paper/cover-fit';
import type { CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BlankField, cssVars } from './parts';
import SketchDoodles from './SketchDoodles';

/** 번호 동그라미의 기울기(도) — 손으로 그린 듯 칸마다 다르게 */
const BADGE_TILT = [-8, 6, -4, 9] as const;

function Badge({ n }: { n: number }) {
  const tilt = BADGE_TILT[(n - 1) % BADGE_TILT.length];
  return (
    <svg className="pbc-sketch__badge" width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
      <ellipse
        cx="17" cy="17" rx="15" ry="14" stroke="currentColor" strokeWidth="1.3"
        transform={`rotate(${tilt} 17 17)`}
      />
      <text x="17" y="23" textAnchor="middle" fontFamily="Instrument Serif, serif" fontSize="19" fill="currentColor">
        {n}
      </text>
    </svg>
  );
}

/**
 * E 스케치 — 윤곽선 영문, 손그림 별·화살표, 단원 네 칸 격자.
 * 시안의 단원 설명 글은 옮기지 않았다(적을 칸이 없다). 격자 칸 높이는 시안 그대로라 화살표 자리가 맞는다.
 */
export default function SketchCover({ title, course, topics, showNameBox, year }: CoverLayoutProps) {
  const grid = sketchGridTopics(topics);
  return (
    <div
      className="pb-cover pb-cover--layout pbc-sketch"
      style={cssVars({ '--pbc-title-scale': sketchTitleScale({ title, course }) })}
    >
      <div className="pbc-sketch__frame" aria-hidden="true" />
      <span className="pbc-sketch__word" aria-hidden="true">{COVER_COPY.sketchWord}</span>
      <SketchDoodles topicCount={grid.length} />

      <div className="pbc-sketch__head">
        <h1 className="pbc-sketch__title">{title}</h1>
        <p className="pbc-sketch__kicker">{sketchKicker(course)}</p>
      </div>

      {grid.length > 0 && (
        <ol className="pbc-sketch__topics" style={cssVars({ '--pbc-topic-scale': sketchTopicScale(grid) })}>
          {grid.map((topic, i) => (
            <li key={`${i}-${topic}`} className="pbc-sketch__topic">
              <span className="pbc-sketch__topic-name">{topic}</span>
              <Badge n={i + 1} />
            </li>
          ))}
        </ol>
      )}

      <span className="pbc-sketch__year" aria-hidden="true">{year || COVER_COPY.softMark}</span>
      <p className="pbc-sketch__memo">
        {COVER_COPY.sketchMemo1}
        <br />
        {COVER_COPY.sketchMemo2}
      </p>

      <div className="pbc-sketch__foot">
        <div className="pbc-sketch__fields">
          {showNameBox && (
            <>
              <BlankField label={COVER_COPY.nameLabel} size="md" />
              <BlankField label={COVER_COPY.dateLabel} size="sm" />
            </>
          )}
        </div>
        <span className="pbc-sketch__brand">
          {year ? `${COVER_COPY.brandEn} · ${year}` : COVER_COPY.brandEn}
        </span>
      </div>
    </div>
  );
}
