import { COVER_COPY } from '@/lib/problem-paper/cover-copy';
import { editorialTitleScale } from '@/lib/problem-paper/cover-fit';
import { courseOrSubject, topicsLine, type CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { cssVars } from './parts';

/** 글자 깔림 세로 띠 수 — 시안의 네 띠(둘째·넷째 띠는 조금 내려 앉는다 → editorial.css) */
const FILL_COLUMNS = 4;
/** 띠 하나(폭 ≈150px · 높이 360px, 11px/19px)를 넘치게 채우는 되풀이 수 — 시안 그대로 */
const FILL_REPEAT = 60;

interface TableRow {
  label: string;
  value: string;
  /** 학생이 손으로 적는 빈칸 줄 */
  blank?: true;
}

function tableRows({ teacher, showNameBox }: CoverLayoutProps): TableRow[] {
  const rows: TableRow[] = [];
  if (teacher) rows.push({ label: COVER_COPY.teacherLabel, value: teacher });
  if (showNameBox) rows.push({ label: COVER_COPY.studentLabel, value: '', blank: true });
  return rows;
}

/**
 * A 에디토리얼 — 큰 명조 제목과 괄호 단원 줄, 고정 문구 깔림 위의 저작권 안내, 선생님·학생 표.
 * 과정(부제 첫 줄)은 바닥 가운데('국어 · 논술' 자리)에 싣는다.
 */
export default function EditorialCover(props: CoverLayoutProps) {
  const { title, course, topics, year } = props;
  const line = topicsLine(topics);
  const fill = Array.from({ length: FILL_REPEAT }, () => COVER_COPY.motto).join(' ');
  const rows = tableRows(props);

  return (
    <div
      className="pb-cover pb-cover--layout pbc-editorial"
      style={cssVars({ '--pbc-title-scale': editorialTitleScale(props) })}
    >
      <div className="pbc-editorial__head">
        <span>{COVER_COPY.brandKo}</span>
        <span>{COVER_COPY.sheet}</span>
        <span>{year}</span>
      </div>

      <div className="pbc-editorial__title-band">
        <h1 className="pbc-editorial__title">{title}</h1>
        {line && (
          <p className="pbc-editorial__topics">
            <span className="pbc-editorial__paren" aria-hidden="true">(</span>
            <span className="pbc-editorial__topics-text">{line}</span>
            <span className="pbc-editorial__paren" aria-hidden="true">)</span>
          </p>
        )}
      </div>

      <div className="pbc-editorial__middle">
        <div className="pbc-editorial__fill" aria-hidden="true">
          {Array.from({ length: FILL_COLUMNS }, (_, i) => (
            <div key={i} className="pbc-editorial__fill-col">{fill}</div>
          ))}
        </div>
        <p className="pbc-editorial__notice">{COVER_COPY.copyright}</p>
      </div>

      <div className="pbc-editorial__table">
        {rows.length > 0 && (
          <dl>
            {rows.map((row) => (
              <div key={row.label} className={row.blank ? 'pbc-editorial__row pbc-field' : 'pbc-editorial__row'}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="pbc-editorial__foot">
        <span>{COVER_COPY.brandKo}</span>
        <span>{courseOrSubject(course)}</span>
        <span>{COVER_COPY.paperSize}</span>
      </div>
    </div>
  );
}
