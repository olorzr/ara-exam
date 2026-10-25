import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { softScales } from '@/lib/problem-paper/cover-fit-soft';
import { brandLine, topicsLine, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';

/** 흐린 회색 덩어리 — 시안의 다섯(soft.css `--a`~`--e`) */
const BLOBS = ['a', 'b', 'c', 'd', 'e'] as const;
/** 점선 원 셋 */
const DOTS = ['a', 'b', 'c'] as const;

/**
 * D 블러 — 옅은 회색 번짐과 점선 원 위에 굵은 제목과 단원 줄, 오른쪽 세로 글.
 *
 * 시안은 태그라인을 `top: 760px` 에 박아 두었다 — 제목이 길어지면 겹친다. 제목·단원·태그라인을
 * 한 흐름에 두고 바닥 글은 `bottom` 기준이다. 제목·단원 크기는 그 흐름이 바닥 글에 닿지 않게 함께 정한다
 * (`softScales`, 중철 면 1,082px 기준).
 */
export default function SoftCover(props: CoverLayoutProps) {
  const { title, course, topics, showNameBox, year, teacher } = props;
  const line = topicsLine(topics);
  const scales = softScales(props);

  return (
    <div
      className="pb-cover pb-cover--layout pbc-soft"
      style={cssVars({ '--pbc-title-scale': scales.title, '--pbc-topic-scale': scales.topic })}
    >
      {BLOBS.map((b) => <div key={b} className={`pbc-soft__blob pbc-soft__blob--${b}`} aria-hidden="true" />)}
      {DOTS.map((d) => <div key={d} className={`pbc-soft__dot pbc-soft__dot--${d}`} aria-hidden="true" />)}

      <span className="pbc-soft__mark" aria-hidden="true">{COVER_COPY.mark}</span>
      <p className="pbc-soft__kicker">{COVER_COPY.softKicker}</p>

      <div className="pbc-soft__body">
        <h1 className="pbc-soft__title">{title}</h1>
        {line && <p className="pbc-soft__topics">{line}</p>}
        <p className="pbc-soft__tagline">{COVER_COPY.softTagline}</p>
      </div>

      <span className="pbc-soft__vertical" aria-hidden="true">
        {year ? `${COVER_COPY.softVertical} · ${year}` : COVER_COPY.softVertical}
      </span>

      <div className="pbc-soft__foot">
        <div className="pbc-soft__note">
          {teacher && (
            <p><span className="pbc-soft__label">{COVER_COPY.teacherLabel}</span>{'  '}{teacher}</p>
          )}
          <p>{brandLine(course, year)}</p>
        </div>
        {showNameBox && (
          <span className="pbc-field pbc-soft__field">
            <span className="pbc-soft__label">{COVER_COPY.studentLabel}</span>
            <span className="pbc-soft__field-line" aria-hidden="true" />
          </span>
        )}
      </div>
    </div>
  );
}
