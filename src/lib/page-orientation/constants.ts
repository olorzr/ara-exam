import { MAX_TURN_IMAGES } from '@/lib/ai/codex/protocol';

/** 쪽 방향 판정의 정책값 */

/**
 * 방향 판정에 보낼 이미지의 긴 변 (픽셀).
 *
 * 글자를 **읽을** 필요가 없다 — 어느 쪽이 위인지만 알면 된다. 작게 보낼수록 싸고 빠르다.
 */
export const ORIENTATION_MAX_SIDE = 900;

/** 방향만 보면 되므로 화질은 낮아도 된다 */
export const ORIENTATION_JPEG_QUALITY = 0.6;

/** 한 번에 물어볼 쪽 수 — 한 turn 의 이미지 상한을 그대로 따른다 */
export const ORIENTATION_PAGES_PER_CALL = MAX_TURN_IMAGES;

/** 출력이 쪽마다 숫자 하나뿐이라 짧게 잡는다 */
export const ORIENTATION_TIMEOUT_MS = 90_000;
