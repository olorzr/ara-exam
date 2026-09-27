import { normalizeCategoryName } from '@/lib/category-name';
import type { PassageWork } from '@/types/problem-bank';

/**
 * 작품명·지은이 표기 정규화 (순수 함수).
 *
 * ⚠️ `exam.normalize_work_title()`(지금 판은 sql/46)과 **완전히 같은
 * 규칙**이어야 한다. 한쪽만 바꾸면 앱이 저장한 값과 트리거가 옮긴 값이 갈라져
 * 작품 트리에 같은 작품이 두 폴더로 보인다(`category-name.ts` ↔ sql/16 과 같은 계약).
 *
 * 배경: 작품 축은 문자열 완전 일치로 묶인다. 시험지는 작품명을 `「동백꽃」`·`<동백꽃>`·
 * `"동백꽃"` 등 제각각으로 인쇄하고 모델도 본 대로 옮기므로, 감싼 기호를 벗기지 않으면
 * 같은 작품이 서너 갈래로 쪼개진다.
 *
 * 안쪽 기호는 건드리지 않는다 — `봄봄 「동백꽃」` 처럼 두 작품을 한 칸에 적은 경우
 * 가운데 기호는 뜻이 있다.
 *
 * ⚠️ **작품이 여럿인 지문의 원본은 목록이다**(`passages.works`·`problems.work_titles`, sql/33).
 *    아래 이음·나눔 함수들은 그 목록과 **파생 문자열**(`title`·`work_title`) 사이를 오가는
 *    자리이고, DB 의 `exam.split_work_titles`·`exam.normalize_works` 와 **1:1 거울**이다.
 */

/** 작품명을 감싸는 기호들 — 낫표·겹낫표·꺾쇠·따옴표 */
const WRAPPER_CHARS = '「」『』〈〉《》＜＞<>“”‘’"\'';

/**
 * 공백류 — JS 의 `\s` 와 같은 집합을 **직접 나열한다**.
 *
 * ⚠️ `\s` 로 쓰면 안 된다: Postgres 의 `\s` 는 **ASCII 공백만** 잡아서, NBSP 가 앞에 붙은
 *    `「동백꽃」` 에서 앱은 `동백꽃` 을 DB 는 `「동백꽃」` 을 만들고 **같은 작품이 두 갈래로
 *    쌓인다**(코덱스 리뷰). sql/33 이 이 집합을 그대로 나열하므로 나란히 놓고 대조할 수 있어야
 *    한다(`category-name.ts` ↔ sql/16 과 같은 규약).
 */
const SPACE_CHARS = '\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF';

/** 앞뒤에 붙은 감싸는 기호와 공백 */
const LEADING_WRAPPERS = new RegExp(`^[${WRAPPER_CHARS}${SPACE_CHARS}]+`);
const TRAILING_WRAPPERS = new RegExp(`[${WRAPPER_CHARS}${SPACE_CHARS}]+$`);

/**
 * 줄표 글자들 — 하이픈·줄표·가로줄(U+2010~2015)·빼기(U+2212)·작은·전각 하이픈.
 *
 * 전부 `-` 로 맞춘다. 『지상의 방 한 칸 - …』 이 하이픈과 엔대시(–)로 갈려 작품 트리에
 * 두 잎으로 섰다 — 글자만 다르고 뜻은 같다. sql/46 의 `translate` 목록과 글자 하나까지 같다.
 */
const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;

/**
 * 작품명·지은이를 표준 표기로.
 *
 * 감싼 기호 제거 → 줄표 통일 → `normalizeCategoryName`(폭 없는 문자·NFC·전각 괄호·공백·
 * 괄호 주변). 멱등이다.
 * @param name - 모델이 읽었거나 사람이 친 이름
 * @returns 표준 표기
 */
export function normalizeWorkTitle(name: string): string {
  return normalizeCategoryName(
    name.replace(LEADING_WRAPPERS, '').replace(TRAILING_WRAPPERS, '').replace(DASHES, '-'),
  );
}

/** 안이 한자·공백·가운뎃점·쉼표뿐인 괄호 — `(李生窺墻傳)` 은 잡고 `(김완진 해독)` 은 놓는다 */
const HANJA_PARENS = new RegExp(
  `\\([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF·,${SPACE_CHARS}]+\\)`, 'g',
);
const ALL_SPACES = new RegExp(`[${SPACE_CHARS}]`, 'g');

/**
 * 작품명 비교 열쇠 — 띄어쓰기와 한자 괄호를 무시한다.
 *
 * 표기를 바꾸는 함수가 아니라 **같은 작품인지 볼 때만** 쓴다(`엄마 걱정` ↔ `엄마걱정`,
 * `이생규장전` ↔ `이생규장전(李生窺墻傳)`). DB 는 이 열쇠로 표준 표기 대장
 * (`exam.work_title_canon`)을 찾아 저장값을 맞춘다 — `exam.work_title_key` 와 1:1 거울이다.
 *
 * ⚠️ 한글이 한 글자라도 든 괄호는 남긴다 — `제망매가(김완진 해독)` 은 따로 서야 하는 작품이다.
 * @param title - 작품명
 * @returns 비교 열쇠
 */
export function workTitleKey(title: string): string {
  return normalizeWorkTitle(title).replace(HANJA_PARENS, '').replace(ALL_SPACES, '');
}

/**
 * 작품명을 이어 적을 때 쓰는 기호 — **가운뎃점 하나에 양쪽 공백**으로 못박는다.
 * DB 의 파생 문자열(`exam.works_titles` 를 잇는 값)이 같은 글자를 쓴다.
 */
export const WORK_JOIN = ' · ';

/** 비교 열쇠의 구분자 — 이름에 들어갈 일이 없는 제어 문자 */
const FIELD_SEP = '\u0000';
const ROW_SEP = '\u0001';

/** 한 지문에 실릴 수 있는 작품 수 — DB 의 CHECK(6)와 같아야 한다 */
export const WORKS_MAX = 6;

/**
 * 나눌 때 받아 주는 이음 기호들.
 * 읽어 낸 값에는 U+00B7(·)·U+2022(•)·U+30FB(・)가 섞여 온다 — 셋 다 받는다.
 */
const WORK_SPLIT = new RegExp(`[${SPACE_CHARS}]*[·•・][${SPACE_CHARS}]*`);

/**
 * 이어 적은 작품명 문자열을 목록으로.
 *
 * 표기 정규화까지 하고 빈 값·중복을 걷어낸다(등장 순서는 지킨다).
 * @param text - `'먼 후일 · 독은 아름답다'` 같은 문자열
 * @returns 표준 표기 목록 (최대 `WORKS_MAX`)
 */
export function splitWorkTitles(text: string): string[] {
  const out: string[] = [];
  for (const part of (text ?? '').split(WORK_SPLIT)) {
    const title = normalizeWorkTitle(part);
    if (!title || out.includes(title)) continue;
    out.push(title);
    if (out.length >= WORKS_MAX) break;
  }
  return out;
}

/**
 * 목록을 파생 문자열로 — 인쇄·검색이 읽는 모양이다.
 * @param titles - 작품명 목록
 * @returns `'먼 후일 · 독은 아름답다'`
 */
export function joinWorkTitles(titles: readonly string[]): string {
  return titles.join(WORK_JOIN);
}

/**
 * 작품명 목록 다듬기 — 원소 안에 남은 이음 기호까지 쪼갠다.
 *
 * ⚠️ 쪼개지 않으면 `split(join(x)) === x` 가 깨져서, DB 의 파생 문자열을 되나눌 때
 *    원소가 늘어 목록과 문자열이 영영 어긋난다(`exam.normalize_work_titles` 와 같은 규칙).
 * @param titles - 사람이 치거나 모델이 낸 목록
 * @returns 표준 표기 목록
 */
export function normalizeWorkTitles(titles: readonly string[]): string[] {
  return splitWorkTitles(joinWorkTitles([...titles]));
}

/**
 * 지문 작품 목록 다듬기 — DB 의 `exam.normalize_works` 와 **1:1 거울**이다.
 *
 * 표기를 맞추고, 제목 없는 줄은 버리고, 제목 안에 남은 이음 기호는 쪼개고, 같은 제목은
 * 첫 줄만 남긴다. 한쪽만 바꾸면 앱이 보낸 값과 DB 가 저장한 값이 갈라진다.
 * @param works - 화면에서 친 목록
 * @returns 표준 표기 목록 (최대 `WORKS_MAX`)
 */
export function normalizePassageWorks(works: readonly PassageWork[]): PassageWork[] {
  const out: PassageWork[] = [];
  for (const work of works) {
    const label = normalizeWorkLabel(work.label);
    const author = normalizeWorkTitle(work.author ?? '');
    // 제목 칸에 '봄봄 · 동백꽃' 을 통째로 친 경우 여기서 쪼갠다
    for (const title of splitWorkTitles(work.title ?? '')) {
      if (out.length >= WORKS_MAX) return out;
      if (out.some((w) => w.title === title)) continue;
      out.push({ label, title, author });
    }
  }
  return out;
}

/** 구분 표시 다듬기 — 괄호·공백을 벗기고 넉 자로 자른다 ('(가)' → '가') */
export function normalizeWorkLabel(label: string): string {
  return (label ?? '').replace(/[()（）[\]〈〉<>\s]/g, '').slice(0, 4);
}

/**
 * 작품 목록을 한 줄 이름표로 — `(가) 진달래꽃 · 김소월`.
 * @param work - 작품 한 편
 * @returns 화면에 그릴 문자열
 */
export function workLabelText(work: PassageWork): string {
  const head = work.label ? `(${work.label}) ` : '';
  return work.author ? `${head}${work.title} · ${work.author}` : `${head}${work.title}`;
}

/**
 * 작품 목록을 비교할 수 있는 열쇠로.
 *
 * 구분 표시·지은이까지 본다 — `(가)` 만 고쳤어도 저장·전파가 필요하다.
 * ⚠️ `JSON.stringify(works)` 를 쓰지 않는다. 키 순서가 다른 객체(서버가 준 것 ↔ 화면이
 *    만든 것)가 다른 문자열이 되어 안 바뀐 저장이 바뀐 것으로 보인다.
 * @param works - 작품 목록
 * @returns 안정된 문자열
 */
export function worksKey(works: readonly PassageWork[]): string {
  return works.map((w) => [w.label, w.title, w.author].join(FIELD_SEP)).join(ROW_SEP);
}

/**
 * 작품 목록을 **표준 표기와 무관하게** 견주는 열쇠 — 제목만 `workTitleKey` 로 접는다.
 *
 * 편집기가 `엄마걱정` 으로 저장해도 DB 는 대장 표기 `엄마 걱정` 으로 넣는다. 이 열쇠가 같으면
 * 사람이 고친 것은 그대로 들어간 것이라, 화면이 서버 값을 받아들여도 입력을 잃지 않는다.
 * @param works - 작품 목록
 * @returns 안정된 문자열
 */
export function worksMatchKey(works: readonly PassageWork[]): string {
  // ⚠️ 접은 뒤 겹친 줄은 첫 줄만 남긴다 — DB 도 표준 표기로 바꾼 뒤 `normalize_works` 가
  //    같은 제목의 뒷줄을 버린다. 안 걷으면 한 지문에 `엄마 걱정`·`엄마걱정` 을 함께 친 카드가
  //    줄 수가 달라 영영 '저장 안 됨' 으로 남는다(코덱스 2R)
  const seen = new Set<string>();
  const folded: PassageWork[] = [];
  for (const w of works) {
    const title = workTitleKey(w.title);
    if (seen.has(title)) continue;
    seen.add(title);
    folded.push({ ...w, title });
  }
  return worksKey(folded);
}
