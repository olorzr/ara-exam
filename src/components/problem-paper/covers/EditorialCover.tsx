import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { editorialTitleScale } from '@/lib/problem-paper/cover-fit';
import { coverFillText, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';

/** 글자 깔림 세로 띠 수 — 시안의 일곱 띠(띠마다 기울기가 다르다 → editorial.css) */
const FILL_COLUMNS = 7;
/** 띠 하나를 채우고 남는 글자 수(10px 글자 · 폭 100px · 높이 460px ≈ 350자) */
const FILL_MIN_CHARS = 600;

interface TableRow {
  label: string;
  value: string;
  /** 띄어쓰기를 그대로 둔다(날짜 빈칸) */
  pre?: boolean;
}

function tableRows({ course, topics, showNameBox, year }: CoverLayoutProps): TableRow[] {
  const rows: TableRow[] = [];
  if (course) rows.push({ label: COVER_COPY.courseLabel, value: course });
  if (topics.length > 0) rows.push({ label: COVER_COPY.topicsLabel, value: topics.join(' · ') });
  if (showNameBox) {
    rows.push({ label: COVER_COPY.nameLabel, value: '' });
    rows.push({ label: COVER_COPY.dateLabel, value: year ? `${year}  .      .` : '', pre: true });
  }
  return rows;
}

/**
 * A 에디토리얼 — 큰 명조 제목, 기울어진 글자 깔림 위의 저작권 안내, 아래 정보 표.
 * 정보 표의 '과정' 은 부제 첫 줄, '단원' 은 부제 둘째 줄부터를 ` · ` 로 잇는다.
 */
export default function EditorialCover(props: CoverLayoutProps) {
  const { title, course, topics, year } = props;
  const fill = coverFillText(
    [`${COVER_COPY.brandKo} ${COVER_COPY.sheet}`, title, course, ...topics], FILL_MIN_CHARS, COVER_COPY.brandEn,
  );
  const rows = tableRows(props);

  return (
    <div
      className="pb-cover pb-cover--layout pbc-editorial"
      style={cssVars({ '--pbc-title-scale': editorialTitleScale(title) })}
    >
      <div className="pbc-editorial__head">
        <span>{COVER_COPY.brandEn}</span>
        <span>{COVER_COPY.sheet}</span>
        <span>{year}</span>
      </div>

      <div className="pbc-editorial__title-band">
        <h1 className="pbc-editorial__title">{title}</h1>
      </div>

      <div className="pbc-editorial__middle">
        <div className="pbc-editorial__fill" aria-hidden="true">
          {Array.from({ length: FILL_COLUMNS }, (_, i) => (
            <div key={i} className="pbc-editorial__fill-col">{fill}</div>
          ))}
        </div>
        <p className="pbc-editorial__notice">{COVER_COPY.copyright}</p>
      </div>

      <dl className="pbc-editorial__table">
        {rows.map((row) => (
          <div key={row.label} className="pbc-editorial__row">
            <dt>{row.label}</dt>
            <dd className={row.pre ? 'pbc-editorial__pre' : undefined}>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="pbc-editorial__foot">
        <span>{COVER_COPY.brandKo}</span>
        <span>{COVER_COPY.subject}</span>
        <span>{COVER_COPY.paperSize}</span>
      </div>
    </div>
  );
}
