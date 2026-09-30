/** 앱 전체에서 사용되는 포인트 컬러 (Tiffany Blue) */
export const COLOR_PRIMARY = '#81D8D0';

/** 포인트 컬러 hover 상태 */
export const COLOR_PRIMARY_HOVER = '#6bc4bc';

/** 기본 합격 기준 퍼센트 */
export const DEFAULT_PASS_PERCENTAGE = 80;

/** 시험지 최소 단어 수 (객관식 5지선다 = 정답 1 + 오답 4 확보용) */
export const MIN_EXAM_WORDS = 5;

/** 퍼센트 계산용 기준값 */
export const PERCENTAGE_BASE = 100;

/** 비밀번호 최소 길이 */
export const PASSWORD_MIN_LENGTH = 6;

/** 임시 저장 localStorage 키 */
export const DRAFT_STORAGE_KEY = 'voca-draft';

/** 중등 학년 옵션 */
export const MIDDLE_SCHOOL_GRADES = ['중1', '중2', '중3'] as const;

/** 고등 학년 옵션 */
export const HIGH_SCHOOL_GRADES = ['고1', '고2', '고3'] as const;

/** 학기 옵션 */
export const SEMESTER_OPTIONS = ['1학기', '2학기'] as const;

/** 외부지문 카테고리 레벨명 */
export const EXTERNAL_LEVEL = '외부지문 및 프린트' as const;

/**
 * 관리자(원장) 이메일.
 * ⚠️ DB 정책 두 곳이 같은 리터럴을 든다 — 바꾸면 함께 고칠 것:
 *    sql/03(감사 로그 읽기) · sql/57(올라간 기출 삭제).
 */
export const ADMIN_EMAIL = 'ara0723@araeducation.co.kr';

/**
 * 로그인 이메일이 관리자(원장) 계정인지 판정한다.
 * 감사 로그 메뉴, 올라간 기출 삭제 단추가 이 판정을 쓴다 — 권위는 DB 정책이고 이건 화면 게이트다.
 * @param email - 로그인 사용자 이메일 (null/undefined 허용)
 * @returns 관리자면 true
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  return email === ADMIN_EMAIL;
}

/** 로그인을 허용할 이메일 도메인 (이 도메인 계정만 사용 가능) */
export const ALLOWED_EMAIL_DOMAIN = 'araeducation.co.kr';

/**
 * 이메일이 허용 도메인에 속하는지 검사한다(타입 가드: 통과 시 string 으로 좁힘).
 * @param email - 검사할 이메일 (null/undefined 허용)
 * @returns 허용 도메인이면 true
 */
export function isAllowedEmailDomain(email: string | null | undefined): email is string {
  return !!email && email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}
