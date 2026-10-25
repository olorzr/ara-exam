import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { sketchHeadScales, sketchKicker } from '@/lib/problem-paper/cover-fit';
import { brandLine, topicsLine, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';
import SketchDoodles from './SketchDoodles';

/** 번호 동그라미의 기울기(도) — 손으로 그린 듯 칸마다 다르게 */
const BADGE_TILT = [-8, 6] as const;

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
 * E 스케치 — 윤곽선 명조 제목, 손그림 별·화살표, 선생님·학생 두 칸, 오른쪽 아래 윤곽선 '아라.'.
 * 제목 아래 묶음(단원 · 태그라인 · 과정 줄)은 한 흐름이라 제목이 길어 줄이 늘면 함께 내려가고,
 * 그 흐름이 선생님·학생 칸(top 470px)에 닿지 않게 제목·단원·과정 줄 크기를 함께 정한다(`sketchHeadScales`).
 */
export default function SketchCover(props: CoverLayoutProps) {
  const { title, topics, showNameBox, year, teacher } = props;
  const line = topicsLine(topics);
  const scales = sketchHeadScales(props);
  return (
    <div
      className="pb-cover pb-cover--layout pbc-sketch"
      style={cssVars({ '--pbc-title-scale': scales.title, '--pbc-sub-scale': scales.sub })}
    >
      <div className="pbc-sketch__frame" aria-hidden="true" />
      <SketchDoodles arrow={Boolean(teacher) && showNameBox} />

      <div className="pbc-sketch__head">
        <h1 className="pbc-sketch__title">{title}</h1>
        <div className="pbc-sketch__sub">
          {line && <p className="pbc-sketch__topics">{line}</p>}
          <p className="pbc-sketch__tagline">{COVER_COPY.sketchTagline}</p>
          <p className="pbc-sketch__kicker">{sketchKicker(props)}</p>
        </div>
      </div>

      <div className="pbc-sketch__grid">
        {teacher && (
          <div className="pbc-sketch__cell pbc-sketch__cell--teacher">
            <div className="pbc-sketch__cell-head">
              <span className="pbc-sketch__label">{COVER_COPY.teacherLabel}</span>
              <Badge n={1} />
            </div>
            <p className="pbc-sketch__teacher">{teacher}</p>
          </div>
        )}
        {showNameBox && (
          <div className="pbc-field pbc-sketch__cell pbc-sketch__cell--student">
            <div className="pbc-sketch__cell-head">
              <Badge n={teacher ? 2 : 1} />
              <span className="pbc-sketch__label">{COVER_COPY.studentLabel}</span>
            </div>
            <span className="pbc-sketch__student-line" aria-hidden="true" />
          </div>
        )}
      </div>

      <span className="pbc-sketch__mark" aria-hidden="true">{COVER_COPY.mark}</span>
      <p className="pbc-sketch__memo">
        {COVER_COPY.sketchMemo1}
        <br />
        {COVER_COPY.sketchMemo2}
      </p>

      <div className="pbc-sketch__foot">
        <span>{COVER_COPY.subject}</span>
        <span className="pbc-sketch__brand">{brandLine(year)}</span>
      </div>
    </div>
  );
}
