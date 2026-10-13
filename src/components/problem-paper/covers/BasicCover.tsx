import { basicCoverScale } from '@/lib/problem-paper/cover-fit';
import type { CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';

/** 이름 칸 — 학생이 손으로 적는다 */
const NAME_FIELDS = ['학교', '학년 · 반', '이름'] as const;

/**
 * 간단 표지(예전부터 있던 모양) — 학원 이름 · 큰 제목 · 부제 · 이름 칸.
 * 부제는 적은 줄 그대로(`pre-line`) 찍되, 빈 줄을 걷고 단원 상한(`splitSubtitle`)을 거친 줄이다 —
 * 부제 칸이 여러 줄을 받게 되면서 줄 수가 끝없이 늘어 이름 칸이 종이 밖으로 밀릴 수 있었다(코덱스 1R).
 * 제목과 부제가 함께 너무 길면 둘을 같이 줄인다(`basicCoverScale`, 보통은 1 — 예전 모양 그대로).
 */
export default function BasicCover(props: CoverLayoutProps) {
  const { title, course, topics, showNameBox } = props;
  const subtitle = [course, ...topics].filter(Boolean).join('\n');
  return (
    <div className="pb-cover pb-cover--simple" style={cssVars({ '--pb-cover-scale': basicCoverScale(props) })}>
      <div className="pb-cover__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={24} height={24} />
        <span>아라국어논술</span>
      </div>

      <div className="pb-cover__main">
        <span className="pb-cover__accent" aria-hidden="true" />
        <h1 className="pb-cover__title">{title}</h1>
        {subtitle && <p className="pb-cover__subtitle">{subtitle}</p>}
      </div>

      {showNameBox && (
        <dl className="pb-cover__names">
          {NAME_FIELDS.map((field) => (
            <div key={field} className="pb-cover__name-row">
              <dt>{field}</dt>
              <dd />
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
