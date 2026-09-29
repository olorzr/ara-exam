import { publicDb } from '@/lib/supabase-public';

/**
 * 만든 선생님 이름 — 관리자시스템 `public.profiles(id, name)` 에서 읽는다(읽기 전용).
 *
 * 이 앱에는 선생님 표가 없고, 행의 `user_id` 가 곧 `auth.users.id` 이자 `profiles.id` 다.
 * ⚠️ **실패해도 조용히 빈 지도를 돌려준다** — 이름은 곁들이는 정보라 못 읽었다고 목록을
 *    막으면 안 된다. `profiles` 는 RLS 가 재직 중인 교직원(`is_active_staff()`)에게만 열려 있다.
 * @param ids - 만든 사람 id 들 (중복 허용)
 * @returns id → 이름
 */
export async function fetchCreatorNames(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names = new Map<string, string>();
  if (unique.length === 0) return names;
  try {
    const { data, error } = await publicDb().from('profiles').select('id, name').in('id', unique);
    if (error) return names;
    for (const row of (data ?? []) as { id: string; name: string | null }[]) {
      if (row.name?.trim()) names.set(row.id, row.name.trim());
    }
  } catch {
    // 이름을 못 읽어도 목록은 그대로 보인다
  }
  return names;
}
