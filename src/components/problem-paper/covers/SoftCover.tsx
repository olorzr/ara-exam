import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { SOFT_BODY_TOPICS, softFootNotes, softScales } from '@/lib/problem-paper/cover-fit-soft';
import { coverFillText, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';

/** 회색 종이(330×300px, 10px 글자) 를 채우고 남는 글자 수 */
const FILL_MIN_CHARS = 900;

/**
 * D 블러 — 흐린 먹 번짐과 점선 원 위에 흰 굵은 제목.
 *
 * 시안은 태그라인을 `top: 760px` 에 박아 두었다 — 제목이 길어지면 겹친다. 제목·단원·태그라인을
 * 한 흐름에 두고 바닥 글은 `bottom` 기준이다. 제목·단원 크기는 그 흐름이 바닥 글에 닿지 않게 함께 정한다
 * (`softScales`, 중철 면 1,082px 기준). 셋째 단원부터는 바닥 글에 잇는다(`softFootNotes`).
 */
export default function SoftCover(props: CoverLayoutProps) {
  const { title, course, topics, showNameBox, year } = props;
  const bodyTopics = topics.slice(0, SOFT_BODY_TOPICS);
  // 제목과 단원 줄을 함께 바닥 글 위에 들도록 정한다(단원 줄은 제목보다 크지 않다)
  const scales = softScales(props);
  const fill = coverFillText([title, course, ...topics], FILL_MIN_CHARS, COVER_COPY.brandKo);

  return (
    <div
      className="pb-cover pb-cover--layout pbc-soft"
      style={cssVars({ '--pbc-title-scale': scales.title, '--pbc-topic-scale': scales.topic })}
    >
      <div className="pbc-soft__wash" aria-hidden="true" />
      <div className="pbc-soft__paper" aria-hidden="true">{fill}</div>
      <div className="pbc-soft__blur pbc-soft__blur--dark" aria-hidden="true" />
      <div className="pbc-soft__blur pbc-soft__blur--mid" aria-hidden="true" />
      <div className="pbc-soft__dot pbc-soft__dot--a" aria-hidden="true" />
      <div className="pbc-soft__dot pbc-soft__dot--b" aria-hidden="true" />
      <div className="pbc-soft__dot pbc-soft__dot--c" aria-hidden="true" />

      <span className="pbc-soft__mark" aria-hidden="true">{COVER_COPY.softMark}</span>
      <p className="pbc-soft__kicker">
        {`${COVER_COPY.brandEn} — ${COVER_COPY.sheet}${year ? ` ${year}` : ''}`}
      </p>

      <div className="pbc-soft__body">
        <h1 className="pbc-soft__title">{title}</h1>
        {bodyTopics.map((topic, i) => (
          <p key={`${i}-${topic}`} className="pbc-soft__topic">{topic}</p>
        ))}
        <p className="pbc-soft__tagline">{COVER_COPY.softTagline}</p>
      </div>

      <div className="pbc-soft__foot">
        <div className="pbc-soft__note">
          {softFootNotes(props).map((line, i) => <p key={`${i}-${line}`}>{line}</p>)}
        </div>
        {showNameBox && (
          <div className="pbc-soft__fields">
            <span className="pbc-soft__field"><span>{COVER_COPY.nameLabel}</span><span className="pbc-soft__field-line" /></span>
            <span className="pbc-soft__field"><span>{COVER_COPY.dateLabel}</span><span className="pbc-soft__field-line" /></span>
          </div>
        )}
      </div>
    </div>
  );
}
