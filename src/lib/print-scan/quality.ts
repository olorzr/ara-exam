import { listSome } from '@/lib/problem-ocr/warnings';

/**
 * 보낸 이미지의 **화질**에 대한 경고 (순수 함수).
 *
 * ⚠️ 예전에는 예산을 못 맞춘 쪽을 사다리 아래 칸으로 조용히 낮춰 보냈다. 하필 **노이즈가
 *    많아 압축이 안 되는 스캔**이 그렇게 되는데, 그런 쪽이 가장 안 읽힌다 — 결과만 보면
 *    "AI 가 못 읽었다" 와 "우리가 흐리게 보냈다" 를 가릴 수 없었다.
 */

/**
 * 화질을 낮춰 보낸 쪽을 알린다.
 * @param pages - 낮춰 보낸 쪽 번호들
 * @returns 경고 한 줄. 없으면 null
 */
export function degradedPagesWarning(pages: readonly number[]): string | null {
  if (pages.length === 0) return null;
  return `${listSome(pages)}쪽은 스캔 파일이 커서 화질을 낮춰 보냈어요. `
    + '글자가 흐리게 읽혔을 수 있으니 원본과 대조해 주세요.';
}
