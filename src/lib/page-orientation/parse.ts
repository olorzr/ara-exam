import type { OrientationJudgement } from './schema';

/**
 * 방향 판정 응답을 검증한다 (순수 함수).
 *
 * ⚠️ **fail-open** 이다 — 못 알아들은 자리는 '돌리지 않음 · 글자 있음' 으로 둔다.
 *    방향 판정은 읽기를 돕는 보조 단계이므로, 판정이 흔들린다고 읽기를 멈추면 안 된다.
 *    `hasText` 를 기본 true 로 두는 것도 같은 까닭이다: 빈 쪽으로 단정하면 그 쪽이
 *    안 읽혔을 때의 경고까지 조용히 사라진다.
 */

/** 못 알아들었을 때의 기본값 */
const FALLBACK: OrientationJudgement = { rotation: 0, hasText: true };

/** 허용하는 각도 */
const ANGLES = new Set([0, 90, 180, 270]);

/**
 * 응답 JSON 을 이미지 순번별 판정으로.
 * @param raw - 검증 전 JSON 문자열
 * @param count - 이번에 보낸 이미지 장수
 * @returns 순번(1-based) 순서의 판정 배열. 길이는 언제나 count
 */
export function parseOrientation(raw: string, count: number): OrientationJudgement[] {
  const out: OrientationJudgement[] = Array.from({ length: Math.max(0, count) }, () => ({
    ...FALLBACK,
  }));

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== 'object') return out;

  const rows = (parsed as Record<string, unknown>).pages;
  if (!Array.isArray(rows)) return out;

  for (const item of rows) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;

    const image = typeof row.image === 'number' ? row.image : Number(row.image);
    if (!Number.isInteger(image) || image < 1 || image > out.length) continue;

    const rotation = typeof row.rotation === 'number' ? row.rotation : Number(row.rotation);
    out[image - 1] = {
      // 모르는 각도는 **돌리지 않는다** — 엉뚱하게 돌리면 멀쩡한 쪽까지 못 읽는다
      rotation: ANGLES.has(rotation) ? (rotation as OrientationJudgement['rotation']) : 0,
      hasText: row.hasText === false ? false : true,
    };
  }

  return out;
}
