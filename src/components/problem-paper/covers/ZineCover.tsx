import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { zineInfoScale, zineLabel, zineLabelScale, zineTitleScale } from '@/lib/problem-paper/cover-fit-zine';
import { courseOrSubject, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';
import { ZineBlob, ZineBox1, ZineBox2, ZineBox3, ZineCup } from './ZineDoodles';

/** 오른쪽 아래 세로 상표 — 시안의 '아라 / 국어 / 논술' */
const BRAND_STACK = COVER_COPY.spinesBox.split(' · ').join('\n');

/**
 * F 라인드로잉 — 굵은 테두리 상자 셋 안의 선 그림, 상자 모서리에 걸친 단원 라벨, 선생님·학생·상표·연도 격자.
 *
 * 시안은 모든 자리를 `top` 으로 박았다 — 중철 면(1,082px)에서는 아래 상자·글이 잘린다. 그래서 아래 묶음
 * (상자3 · 동그라미 · 연도 · 메모 · 상표)은 `bottom` 기준이고, 가운데 상자2 는 위·아래 두 변으로 늘고 준다
 * (그림은 비율을 지키며 상자에 맞춘다). 모토 상자는 상자2 의 아래 왼쪽 모서리에 붙어 따라간다.
 */
export default function ZineCover(props: CoverLayoutProps) {
  const { title, course, showNameBox, year, teacher } = props;
  const label = zineLabel(props);
  return (
    <div
      className="pb-cover pb-cover--layout pbc-zine"
      style={cssVars({
        '--pbc-title-scale': zineTitleScale(title),
        '--pbc-label-scale': zineLabelScale(label),
        '--pbc-info-scale': zineInfoScale(props),
      })}
    >
      <div className="pbc-zine__title-row">
        <h1 className="pbc-zine__title">{title}</h1>
        <ZineCup />
      </div>

      <div className="pbc-zine__box pbc-zine__box--1" aria-hidden="true"><ZineBox1 /></div>
      <p className="pbc-zine__label">{label}</p>

      <div className="pbc-zine__info">
        <div className="pbc-zine__cell">
          {teacher && <><span>{COVER_COPY.teacherLabel}</span><span>{teacher}</span></>}
        </div>
        <div className="pbc-zine__cell">
          {showNameBox && (
            <span className="pbc-field pbc-zine__student">
              <span>{COVER_COPY.studentLabel}</span>
              <span className="pbc-zine__student-line" aria-hidden="true" />
            </span>
          )}
        </div>
        <div className="pbc-zine__cell pbc-zine__cell--end">
          <span>{COVER_COPY.brandKo}</span>
          <span>{courseOrSubject(course)}</span>
        </div>
        <div className="pbc-zine__cell pbc-zine__cell--end pbc-zine__cell--display">
          {year && <span>{year}</span>}
          <span>{COVER_COPY.sheet}</span>
        </div>
      </div>

      <div className="pbc-zine__box pbc-zine__box--2" aria-hidden="true"><ZineBox2 /></div>
      <p className="pbc-zine__motto">{COVER_COPY.zineMotto}</p>

      <div className="pbc-zine__box pbc-zine__box--3" aria-hidden="true"><ZineBox3 /></div>
      <div className="pbc-zine__circle" aria-hidden="true"><ZineBlob /></div>

      <p className="pbc-zine__year">
        {year ? `${year}${COVER_COPY.zineYearTail}\n${COVER_COPY.zineSubject}` : COVER_COPY.zineSubject}
      </p>
      <p className="pbc-zine__note">{COVER_COPY.zineNote}</p>
      <p className="pbc-zine__brand">{BRAND_STACK}</p>
    </div>
  );
}
