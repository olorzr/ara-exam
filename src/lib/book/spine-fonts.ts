/**
 * 책등 제목 글꼴 — 원장님이 고른다(2026-10-26 "위의 폰트는 얼추 고를 수 있도록" · "눈누 바바, 개예쁜거 많음").
 *
 * 글꼴은 두 곳에서 온다 — 구글 글꼴은 globals.css 가 jsdelivr 의 @fontsource 에서, 눈누(noonnu.cc) 글꼴은
 * styles/book-fonts.css 의 @font-face 가 jsdelivr 의 눈누 저장소에서(CSP `style-src`/`font-src` 가 그 CDN 만 연다).
 * ⚠️ 글꼴·굵기를 더하거나 바꾸면 그 CSS 와 여기를 **함께** 고친다 — 한쪽만 고치면 화면은 대체 글꼴로 그려지는데
 *    아무 오류도 안 난다(spine-fonts.test 가 두 CSS 를 읽어 대조한다). 인쇄 전에 그 조각을 미리 받으므로
 *    (`spineFontSpec` → `useFontsReady`) 굵기도 같아야 한다.
 * ⚠️ 눈누 글꼴은 라이선스 표에서 **인쇄 · 웹사이트 · 임베딩이 모두 '사용 가능'** 인 것만 넣는다(book-fonts.css 머리).
 * ⚠️ 책등은 세로쓰기라 숫자·라틴 글자가 옆으로 눕는다 — 숫자 1 이 막대 하나인 손글씨(교보손글씨 2019 · 온글잎 윤탱체)는
 *    누우면 '-' 처럼 보이거나 안 보여서 뺐다. 새 글꼴은 '고1 · 2026' 을 세로로 찍어 보고 넣을 것.
 * 아래쪽 학원 이름은 고르지 않는다 — 학원 로고 글꼴(지마켓 산스 Bold)로 늘 고정이다(`SPINE_BRAND_FONT_SPEC`).
 */

/** 책등 제목 글꼴 이름표 */
export const SPINE_FONT_IDS = [
  'gmarket', 'pretendard', 'paperozi', 'aggravo', 'dohyeon', 'cafe24surround',
  'jua', 'maplestory', 'roundedsmile', 'konkon', 'ttukttak', 'okdandan',
  'nanumpen', 'parkdahyeon', 'omudaye', 'isyun',
  'notoserif', 'gounbatang', 'bookkmyungjo',
] as const;

/** 책등 제목 글꼴 이름표 */
export type SpineFontId = (typeof SPINE_FONT_IDS)[number];

/** 고르기 칸의 묶음 — 차례가 곧 화면 차례다 */
export const SPINE_FONT_GROUPS = ['gothic', 'cute', 'hand', 'serif'] as const;

/** 고르기 칸의 묶음 */
export type SpineFontGroup = (typeof SPINE_FONT_GROUPS)[number];

/** 묶음 이름 */
export const SPINE_FONT_GROUP_LABELS: Record<SpineFontGroup, string> = {
  gothic: '고딕 · 제목',
  cute: '귀여운',
  hand: '손글씨',
  serif: '명조',
};

/** 책등 제목 글꼴 하나 */
export interface SpineFont {
  id: SpineFontId;
  /** 고르기 칸에 보이는 이름 */
  label: string;
  /** CSS `font-family` 의 첫 이름(따옴표 없이) — 글꼴 미리 받기 지정에도 쓴다 */
  family: string;
  /** 받아 둔 굵기 — CSS(@import·@font-face)의 굵기와 같다 */
  weight: number;
  /**
   * 글자 크기 보정 — 같은 글자 크기에서 글자 몸이 작게 그려지는 글꼴(손글씨·둥근 글꼴)을 키운다.
   * 2026-10-26 헤드리스 크롬에서 한글 여섯 자의 글자 몸(폭 × 높이)을 재서 지마켓 산스의 0.9 배쯤 되게 맞췄다
   * (나눔손글씨 펜 0.44 · 박다현체 0.48 · Ok단단 0.56 · 다예쁨 0.64 … 넓이 비). 0.85 넘는 글꼴은 1 그대로. 책등 글자 크기 맞춤(`spineTypeSize`)이
   * 이 값을 곱한 크기로 자리를 재므로 넘치지 않는다.
   */
  sizeScale: number;
  group: SpineFontGroup;
  /** 어디서 온 글꼴인가 — 눈누 글꼴은 라이선스를 다시 볼 때 쓴다 */
  source: 'google' | 'noonnu' | 'app';
}

/** 고를 수 있는 책등 제목 글꼴 — 묶음 안 차례가 곧 고르기 칸의 차례다 */
export const SPINE_FONTS: readonly SpineFont[] = [
  { id: 'gmarket', label: '지마켓 산스', family: 'Gmarket Sans', weight: 700, sizeScale: 1, group: 'gothic', source: 'app' },
  { id: 'pretendard', label: '프리텐다드', family: 'Pretendard Variable', weight: 700, sizeScale: 1, group: 'gothic', source: 'app' },
  { id: 'paperozi', label: '페이퍼로지', family: 'Paperozi', weight: 800, sizeScale: 1, group: 'gothic', source: 'noonnu' },
  { id: 'aggravo', label: '어그로체', family: 'Aggravo', weight: 700, sizeScale: 1, group: 'gothic', source: 'noonnu' },
  { id: 'dohyeon', label: '도현', family: 'Do Hyeon', weight: 400, sizeScale: 1.05, group: 'gothic', source: 'google' },
  { id: 'cafe24surround', label: '카페24 써라운드', family: 'Cafe24Surround', weight: 400, sizeScale: 1, group: 'gothic', source: 'noonnu' },
  { id: 'jua', label: '주아', family: 'Jua', weight: 400, sizeScale: 1, group: 'cute', source: 'google' },
  { id: 'maplestory', label: '메이플스토리', family: 'NexonMaplestory', weight: 700, sizeScale: 1, group: 'cute', source: 'noonnu' },
  { id: 'roundedsmile', label: '학교안심 둥근미소', family: 'SchoolSafetyRoundedSmile', weight: 700, sizeScale: 1, group: 'cute', source: 'noonnu' },
  { id: 'konkon', label: '온글잎 콘콘체', family: 'OngleipKonkon', weight: 400, sizeScale: 1.05, group: 'cute', source: 'noonnu' },
  { id: 'ttukttak', label: '뚝딱감자체', family: 'TtukttakGamja', weight: 400, sizeScale: 1.1, group: 'cute', source: 'noonnu' },
  { id: 'okdandan', label: 'Ok단단체', family: 'OkDandan', weight: 400, sizeScale: 1.2, group: 'cute', source: 'noonnu' },
  { id: 'nanumpen', label: '나눔손글씨 펜', family: 'Nanum Pen Script', weight: 400, sizeScale: 1.35, group: 'hand', source: 'google' },
  { id: 'parkdahyeon', label: '온글잎 박다현체', family: 'OngleipParkDahyeon', weight: 400, sizeScale: 1.3, group: 'hand', source: 'noonnu' },
  { id: 'omudaye', label: '오뮤 다예쁨체', family: 'OmuDaye', weight: 400, sizeScale: 1.15, group: 'hand', source: 'noonnu' },
  { id: 'isyun', label: '이서윤체', family: 'IsYun', weight: 400, sizeScale: 1.1, group: 'hand', source: 'noonnu' },
  { id: 'notoserif', label: '노토 세리프', family: 'Noto Serif KR', weight: 900, sizeScale: 1, group: 'serif', source: 'google' },
  { id: 'gounbatang', label: '고운바탕', family: 'GounBatang', weight: 700, sizeScale: 1, group: 'serif', source: 'noonnu' },
  { id: 'bookkmyungjo', label: '부크크 명조', family: 'BookkMyungjo', weight: 700, sizeScale: 1, group: 'serif', source: 'noonnu' },
];

/** 새 책의 책등 제목 글꼴 — 0.9.58 까지 쓰던 글꼴 그대로. 목록에서 빠진 이름표(0.9.59 의 동글·감자꽃·연성)는 이것으로 읽는다 */
export const DEFAULT_SPINE_FONT: SpineFontId = 'gmarket';

/** 학원 이름(로고) 글꼴 — 미리 받기 지정. book-cover.css 의 `.book-spine__brand`·`.book-cover__brand` 와 같다 */
export const SPINE_BRAND_FONT_SPEC = '700 1em "Gmarket Sans"';

/**
 * 알려진 책등 글꼴 이름표인가.
 * @param value - 검사할 값
 * @returns `SPINE_FONT_IDS` 의 하나면 true
 */
export function isSpineFontId(value: unknown): value is SpineFontId {
  return typeof value === 'string' && (SPINE_FONT_IDS as readonly string[]).includes(value);
}

/**
 * 이름표로 글꼴을 찾는다 — 모르는 값이면 기본 글꼴.
 * @param id - 이름표
 * @returns 글꼴
 */
export function spineFontOf(id: string): SpineFont {
  return SPINE_FONTS.find((f) => f.id === id) ?? SPINE_FONTS[0];
}

/**
 * 그릴 때 쓰는 `font-family` — 고른 글꼴 뒤에 대체 글꼴을 붙인다(조각이 늦게 와도 글자가 사라지지 않게).
 * @param font - 글꼴
 * @returns CSS 값
 */
export function spineFontFamily(font: SpineFont): string {
  return `"${font.family}", "Pretendard Variable", Pretendard, sans-serif`;
}

/**
 * 인쇄 전에 조각을 미리 받을 때 쓰는 지정(`document.fonts.load` 의 첫 인자).
 * @param font - 글꼴
 * @returns `'700 1em "Gmarket Sans"'` 꼴
 */
export function spineFontSpec(font: SpineFont): string {
  return `${font.weight} 1em "${font.family}"`;
}
