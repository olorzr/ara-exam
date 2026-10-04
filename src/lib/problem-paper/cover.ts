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

/** 화면이 쓰는 표지 값 */
export interface PaperCover {
  kind: PaperCoverKind;
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
  title: string;
  subtitle: string;
  show_name_box: boolean;
  image_path: string;
}

/** 표지 제목 상한 — ⚠️ sql/61 의 CHECK(length(title) <= 100) 와 같아야 한다 */
export const COVER_TITLE_MAX = 100;

/** 표지 부제 상한 — ⚠️ sql/61 의 CHECK(length(subtitle) <= 200) 와 같아야 한다 */
export const COVER_SUBTITLE_MAX = 200;

/** 인쇄물 종류별 제목 꼬리 — `ProblemPaperView`·`ProblemAnswerKeyView` 의 제목 규약과 같다 */
export type CoverTitleSuffix = '' | ' - 교사용' | ' - 답지';

/** 새로 표지를 만들 때의 기본값 */
export const DEFAULT_SIMPLE_COVER: PaperCover = {
  kind: 'simple', title: '', subtitle: '', showNameBox: true, imagePath: '',
};

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * DB 에서 읽은 행을 믿을 수 있는 표지 값으로 바꾼다.
 * @param raw - `problem_paper_covers` 한 행 (없으면 null)
 * @returns 표지. 행이 없거나, 모르는 종류이거나, 그림인데 경로가 없으면 null(표지 없음)
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
    title: cover.title.trim().slice(0, COVER_TITLE_MAX),
    subtitle: cover.subtitle.trim().slice(0, COVER_SUBTITLE_MAX),
    show_name_box: cover.showNameBox,
    image_path: cover.kind === 'image' ? cover.imagePath : '',
  };
}
