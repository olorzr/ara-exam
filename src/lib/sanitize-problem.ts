import DOMPurify from 'isomorphic-dompurify';
import { FORBID_ATTR, FORBID_TAGS, SAFE_URI_REGEXP } from './sanitize-html';
import { withProfile, type SanitizeProfile } from './sanitize-profile';

/**
 * 기출 문항·지문 HTML 전용 화이트리스트.
 *
 * 개념지(sanitize-html.ts)와 따로 두는 이유:
 *  - 문항에는 `<blockquote data-box="보기">` 상자가 필요하다(개념지엔 없는 개념).
 *  - 개념지의 `data-concept`(개념어 표시)는 문항에 들어오면 안 된다.
 *
 * ⚠️ 이 HTML 의 출처는 **AI 가 읽어 낸 결과**다. 저장 경로뿐 아니라 파서에서 곧바로,
 *    그리고 로드·렌더 진입에서도 정화한다(개념지와 같은 다층 방어).
 *
 * ⚠️ `img` 는 **허용하지 않는다.** 그림·표 이미지는 Storage 경로를 DB 컬럼에 두고
 *    React 가 서명 URL 로 그린다. 본문 HTML 에 URL 이 들어오면 정화 규칙이 URL 스킴까지
 *    책임져야 하고, 서명 URL 은 만료돼 저장해 둘 수도 없다.
 */
const ALLOWED_TAGS = [
  'h3', 'h4',
  'p', 'br', 'hr',
  'strong', 'em', 'u', 's', 'code',
  'ul', 'ol', 'li', 'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span',
];

const ALLOWED_ATTR = ['colspan', 'rowspan', 'data-box', 'style'];

/**
 * 〈보기〉 상자의 라벨로 허용하는 값.
 * 시험지에 실제로 인쇄되는 것들만 둔다 — 자유 문자열을 허용하면 인쇄 CSS 의
 * `::before` content 로 임의 문구가 들어간다.
 */
const BOX_LABELS = new Set(['보기', '자료', '조건', '가', '나', '다', '라', '마', 'A', 'B']);

/** inline style 은 개념지와 같은 좁은 집합만 — 표 셀 정렬·색이 전부다 */
const ALLOWED_CSS_PROPS = new Set([
  'text-align',
  'background-color',
  'border-top-color',
  'border-bottom-color',
  'border-left-color',
  'border-right-color',
]);

const PROBLEM_PROFILE: SanitizeProfile = {
  allowedCss: ALLOWED_CSS_PROPS,
  allowedDataAttrs: new Map([['data-box', (v: string) => BOX_LABELS.has(v)]]),
};

const PROBLEM_SANITIZE_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: SAFE_URI_REGEXP,
  FORBID_TAGS,
  FORBID_ATTR,
  KEEP_CONTENT: true,
  RETURN_TRUSTED_TYPE: false,
};

/**
 * 문항·지문 HTML 을 안전하게 정화한다.
 * @param dirty - 신뢰할 수 없는 HTML (AI 출력 · 편집기 저장값 · DB 로드값)
 * @returns 화이트리스트 밖 태그·속성·CSS 가 제거된 HTML
 */
export function sanitizeProblemHTML(dirty: string): string {
  if (!dirty) return '';
  return withProfile(PROBLEM_PROFILE, () => DOMPurify.sanitize(dirty, PROBLEM_SANITIZE_CONFIG));
}

/**
 * 선지 한 줄처럼 **블록 태그가 없어야 하는** 짧은 조각을 정화한다.
 * 인쇄에서 선지는 한 칸 안에 들어가야 해서 `<p>`·`<table>` 이 섞이면 레이아웃이 깨진다.
 * @param dirty - 신뢰할 수 없는 인라인 HTML
 * @returns 인라인 태그만 남긴 HTML
 */
export function sanitizeInlineHTML(dirty: string): string {
  if (!dirty) return '';
  return withProfile(PROBLEM_PROFILE, () =>
    DOMPurify.sanitize(dirty, {
      ...PROBLEM_SANITIZE_CONFIG,
      ALLOWED_TAGS: ['strong', 'em', 'u', 's', 'code', 'span', 'br'],
      ALLOWED_ATTR: ['style'],
    }),
  );
}
