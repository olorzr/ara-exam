import { normalizeCategoryName } from '../category-name';
import type { School, SelectableSchool } from '@/types';

/**
 * 선택지에 학교급이 나오는 차례. 학년 선택지(중1 … 고3)와 같은 순서로 둔다 —
 * DB 정렬은 한글 자모순이라 '고등' 이 먼저 나와 화면 감각과 어긋난다.
 */
const LEVEL_ORDER = ['중등', '고등'];

const levelRank = (level?: string) => {
  const i = LEVEL_ORDER.indexOf(level ?? '');
  return i === -1 ? LEVEL_ORDER.length : i;
};

/** 마스터에 짝이 없는 옛 학교임을 화면에 알릴 때 쓰는 꼬리표 */
export const LEGACY_SCHOOL_SUFFIX = ' (옛 항목)';

/**
 * 고를 수 있는 학교 목록을 만든다 — **관리자 마스터 ∪ 이미 프린트가 있는 학교**.
 *
 * 학교의 원본은 관리자시스템 `public.schools` 다. 여기에 `exam.schools`(= 마스터의 거울,
 * sql/27 이후 id 가 같다)를 합치는 까닭은 **보존**이다: 관리자시스템에서 학교가 지워져도
 * 그 학교로 만들어 둔 프린트·시험지는 남으므로, 선택 칸에서 그 학교가 사라지면 편집기가
 * '고른 자리가 빈' 모양이 된다. 도입 시점의 `'전체'` 같은 옛 임시 학교도 이 합집합이 지킨다.
 * 합집합은 보존일 뿐이라 **새 학교를 만들지는 못한다** — 학교 등록은 관리자시스템에서만 한다.
 *
 * 이름은 여기서 한 번 `normalizeCategoryName` 을 지난다. 마스터는 정규화 규약 밖에 있는데
 * 그 이름이 그대로 `categories.school_name` 으로 복사돼 트리 노드를 묶기 때문이다 —
 * 화면 라벨과 저장값이 갈리면 같은 학교가 폴더 두 개로 쪼개진다.
 * @param master - 관리자시스템 학교 목록(중등·고등)
 * @param used - `exam.schools` 에 이미 있는 학교
 * @returns 마스터(학교급 → 이름 순) 다음에 짝 없는 옛 학교(이름 순)
 */
export function mergeSchoolOptions(
  master: readonly { id: string; name: string; level: string }[],
  used: readonly School[],
): SelectableSchool[] {
  const byId = new Map<string, SelectableSchool>();

  // 마스터가 이름의 원본이다 — 거울이 옛 이름을 들고 있어도 마스터 쪽이 이긴다
  for (const s of master) {
    byId.set(s.id, { id: s.id, name: normalizeCategoryName(s.name), level: s.level });
  }
  for (const s of used) {
    if (byId.has(s.id)) continue;
    byId.set(s.id, { id: s.id, name: normalizeCategoryName(s.name), legacy: true });
  }

  return [...byId.values()].sort((a, b) => {
    if (!!a.legacy !== !!b.legacy) return a.legacy ? 1 : -1;
    const rank = levelRank(a.level) - levelRank(b.level);
    return rank !== 0 ? rank : a.name.localeCompare(b.name, 'ko');
  });
}

/**
 * 선택 칸에 보일 글. 옛 항목은 그렇다고 밝힌다 — 마스터에 없는 이름이 그냥 섞여 있으면
 * 선생님이 '관리자시스템에 있는 학교' 로 오해한다.
 * @param school - 선택지 한 줄
 * @returns 화면에 쓸 이름
 */
export function schoolOptionLabel(school: SelectableSchool): string {
  return school.legacy ? `${school.name}${LEGACY_SCHOOL_SUFFIX}` : school.name;
}
