import type { Category } from '@/types';
import { EXTERNAL_LEVEL } from './constants';

interface FormatCategoryOptions {
  /** 출판사(교과서)명을 제외할지 여부 */
  excludePublisher?: boolean;
}

/**
 * 카테고리를 사람이 읽을 수 있는 라벨로 변환한다.
 * @param cat - 변환할 카테고리 객체
 * @param options - 포맷팅 옵션
 * @returns 포맷팅된 카테고리 라벨 문자열
 */
export function formatCategoryLabel(cat: Category, options?: FormatCategoryOptions): string {
  if (cat.level === EXTERNAL_LEVEL) {
    // 년도/학년은 미지정('')이면 생략된다 — 예: `상현중 2026 중2 - 소나기`
    const scope = [cat.school_name || '외부', cat.year, cat.grade].filter(Boolean).join(' ');
    return [scope, cat.chapter].filter(Boolean).join(' - ');
  }
  if (options?.excludePublisher) {
    return [cat.grade, cat.semester, cat.chapter, cat.sub_chapter].filter(Boolean).join(' ');
  }
  return [cat.grade, cat.publisher, cat.semester, cat.chapter, cat.sub_chapter].filter(Boolean).join(' ');
}

/**
 * 카테고리 배열을 level 기준으로 그룹화한다.
 * @param categories - 그룹화할 카테고리 배열
 * @returns level을 키로 하는 카테고리 그룹 객체
 */
export function groupCategoriesByLevel(categories: Category[]): Record<string, Category[]> {
  return categories.reduce<Record<string, Category[]>>((acc, cat) => {
    const key = cat.level;
    if (!acc[key]) acc[key] = [];
    acc[key].push(cat);
    return acc;
  }, {});
}

/**
 * ISO 타임스탬프를 사용자의 로컬 타임존 기준 `YYYY-MM-DD` 문자열로 변환한다.
 * `toISOString().slice(0, 10)` 은 UTC 로 변환해 자정 부근 날짜가 하루 어긋나므로,
 * `<input type="date">`(로컬 해석) 값과 비교할 때는 이 함수를 사용한다.
 * @param dateStr - ISO 형식 날짜 문자열
 * @returns 로컬 기준 `YYYY-MM-DD` 문자열
 */
export function toLocalDateString(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 날짜 문자열을 한국어 포맷으로 변환한다.
 * @param dateStr - ISO 형식 날짜 문자열
 * @returns 한국어 포맷 날짜 문자열
 */
export function formatDateKR(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
