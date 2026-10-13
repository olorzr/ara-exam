/**
 * 문제지 표지 모델 (순수 함수).
 *
 * 표지는 두 가지다 — 앱이 그리는 **간단 표지**(`simple`)와 선생님이 만든 **그림 표지**(`image`).
 * '표지 없음' 은 행이 없는 것이다(`null`).
 *
 * 저장은 곁표 `exam.problem_paper_covers`(sql/61)다 — 문제지 본문은 불변 스냅샷이라
 * 표지를 따로 고칠 수 있게 떼어 두었다.
 */

/** 표지 종류 */
export type PaperCoverKind = 'simple' | 'image';

/**
 * 간단 표지의 디자인. `basic` 은 예전부터 있던 모양이고 나머지 다섯은 클로드 디자인에서 만든
 * 시안(2026-10-06 '문제지 표지 시안')을 옮긴 것이다.
 *
 * ⚠️ sql/70 의 CHECK(layout IN (...)) 와 **같아야 한다**(cover.test.ts 가 고정한다).
 */
export const COVER_LAYOUTS = ['basic', 'editorial', 'rings', 'spines', 'soft', 'sketch'] as const;

/** 간단 표지의 디자인 */
export type PaperCoverLayout = (typeof COVER_LAYOUTS)[number];

/** 디자인 기본값 — 옛 행·그림 표지·모르는 값은 모두 이것이다 */
export const DEFAULT_COVER_LAYOUT: PaperCoverLayout = 'basic';

/** 화면에 보이는 디자인 이름 — 시안의 이름(A 에디토리얼 · B 링 · C 책등 · D 블러 · E 스케치)을 따른다 */
export const COVER_LAYOUT_LABELS: Record<PaperCoverLayout, string> = {
  basic: '간단',
  editorial: '에디토리얼',
  rings: '링',
  spines: '책등',
  soft: '블러',
  sketch: '스케치',
};

/**
 * 알려진 디자인 값인가.
 * @param value - 검사할 값
 * @returns `COVER_LAYOUTS` 의 하나면 true
 */
export function isCoverLayout(value: unknown): value is PaperCoverLayout {
  return typeof value === 'string' && (COVER_LAYOUTS as readonly string[]).includes(value);
}

/** 화면이 쓰는 표지 값 */
export interface PaperCover {
  kind: PaperCoverKind;
  /** 간단 표지의 디자인. 그림 표지면 늘 `DEFAULT_COVER_LAYOUT` 이다 */
  layout: PaperCoverLayout;
  /** 비어 있으면 문제지 제목을 쓴다 */
  title: string;
  subtitle: string;
  /** 이름·학교·반 칸 */
  showNameBox: boolean;
  /** 그림 표지의 Storage 경로(버킷 exam-problem-bank 기준). 간단 표지면 '' */
  imagePath: string;
}

/** DB 행 모양(앱이 보내는 칸만 — user_id·시각은 트리거가 채운다) */
export interface PaperCoverRow {
  paper_id: string;
  kind: PaperCoverKind;
  layout: PaperCoverLayout;
  title: string;
  subtitle: string;
  show_name_box: boolean;
  image_path: string;
}

/**
 * 표지 조회 컬럼 — `toCoverRow` 가 내는 키를 전부 담는다(cover.test.ts 가 고정한다).
 *
 * ⚠️ 한 줄 리터럴이어야 한다 — `+` 로 이으면 리터럴 타입이 `string` 으로 넓어져
 *    PostgREST 행 타입 추론이 풀린다. ⚠️ `layout` 은 sql/70 이 만든다 — 그보다 먼저 배포하면
 *    모든 문제지의 표지 조회가 실패해 인쇄가 잠긴다.
 */
export const COVER_COLUMNS = 'paper_id, kind, layout, title, subtitle, show_name_box, image_path';

/** 표지 제목 상한 — ⚠️ sql/61 의 CHECK(length(title) <= 100) 와 같아야 한다 */
export const COVER_TITLE_MAX = 100;

/** 표지 부제 상한 — ⚠️ sql/61 의 CHECK(length(subtitle) <= 200) 와 같아야 한다 */
export const COVER_SUBTITLE_MAX = 200;

/** 인쇄물 종류별 제목 꼬리 — `ProblemPaperView`·`ProblemAnswerKeyView` 의 제목 규약과 같다 */
export type CoverTitleSuffix = '' | ' - 교사용' | ' - 답지';

/** 인쇄물 꼬리 전부 — 글꼴 조각을 미리 받을 때 이 글자도 함께 받는다(`coverFontSample`) */
export const COVER_TITLE_SUFFIXES: readonly CoverTitleSuffix[] = ['', ' - 교사용', ' - 답지'];

/** 새로 표지를 만들 때의 기본값 */
export const DEFAULT_SIMPLE_COVER: PaperCover = {
  kind: 'simple', layout: DEFAULT_COVER_LAYOUT, title: '', subtitle: '', showNameBox: true, imagePath: '',
};

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * DB 에서 읽은 행을 믿을 수 있는 표지 값으로 바꾼다.
 * @param raw - `problem_paper_covers` 한 행 (없으면 null)
 * @returns 표지. 행이 없거나, 모르는 종류이거나, 그림인데 경로가 없으면 null(표지 없음).
 *   디자인 값이 모르는 것이거나 없으면(sql/70 전의 행) **표지는 살리고** 기본 디자인으로 둔다 —
 *   디자인이 틀렸다고 표지를 버리면 첫 장이 빠진 채 인쇄된다
 */
export function normalizePaperCover(raw: unknown): PaperCover | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = row.kind;
  if (kind !== 'simple' && kind !== 'image') return null;
  const imagePath = kind === 'image' ? text(row.image_path, 512) : '';
  // 그림 표지인데 그림이 없으면 첫 장이 빈 종이로 나간다 — 차라리 표지가 없는 편이 낫다
  if (kind === 'image' && !imagePath) return null;
  return {
    kind,
    layout: kind === 'simple' && isCoverLayout(row.layout) ? row.layout : DEFAULT_COVER_LAYOUT,
    title: text(row.title, COVER_TITLE_MAX),
    subtitle: text(row.subtitle, COVER_SUBTITLE_MAX),
    showNameBox: typeof row.show_name_box === 'boolean' ? row.show_name_box : true,
    imagePath,
  };
}

/**
 * 표지에 찍을 제목.
 * @param cover - 표지
 * @param paperTitle - 문제지 제목 (표지 제목이 비었을 때 쓴다)
 * @param suffix - 인쇄물 꼬리 (교사용·답지)
 * @returns 표지 제목
 */
export function coverTitleFor(cover: PaperCover, paperTitle: string, suffix: CoverTitleSuffix): string {
  const base = cover.title.trim() || paperTitle.trim();
  return `${base}${suffix}`;
}

/**
 * 저장할 행을 만든다. `user_id` 는 싣지 않는다 — 트리거(`enforce_user_id_from_auth`)가 채운다.
 * @param paperId - 문제지 id
 * @param cover - 표지
 * @returns upsert 본문
 */
export function toCoverRow(paperId: string, cover: PaperCover): PaperCoverRow {
  return {
    paper_id: paperId,
    kind: cover.kind,
    // 그림 표지에는 디자인이 없다 — 옛 디자인 값이 남아 다음에 간단 표지로 바꿀 때 되살아나지 않게
    layout: cover.kind === 'simple' ? cover.layout : DEFAULT_COVER_LAYOUT,
    title: cover.title.trim().slice(0, COVER_TITLE_MAX),
    subtitle: cover.subtitle.trim().slice(0, COVER_SUBTITLE_MAX),
    show_name_box: cover.showNameBox,
    image_path: cover.kind === 'image' ? cover.imagePath : '',
  };
}
