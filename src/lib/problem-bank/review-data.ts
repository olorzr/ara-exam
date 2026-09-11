import { fetchPassages, fetchProblemsOfSource, fetchSource } from './queries';
import { signProblemFiles } from './storage';
import { sourcePagePath } from './storage-paths';
import type { Passage, Problem, ProblemSource } from '@/types/problem-bank';

/**
 * 검수 화면이 한 번에 읽어 오는 것들.
 *
 * 훅(`useProblemReview`)에서 떼어 둔 이유는 길이뿐이지만, 덕분에 "무엇을 읽는가" 와
 * "읽은 것을 어떻게 들고 있는가" 가 갈렸다.
 */
export interface ReviewData {
  source: ProblemSource | null;
  passages: Passage[];
  problems: Problem[];
  /** Storage 경로 → 서명 URL (원본 대조용 쪽 이미지) */
  pageUrls: Map<string, string>;
}

/**
 * 출처 하나의 검수 자료를 읽는다.
 *
 * ⚠️ 쪽 이미지는 **OCR 이 읽은 쪽까지** 서명한다. 항목이 있는 쪽만 서명하면
 *    정답표 쪽이 빠져 정답을 대조할 수 없고, 이어지는 쪽도 빠진다(합쳐진 지문은
 *    시작 쪽만 들고 있다 — 코덱스 리뷰 4R).
 * @param sourceId - 출처 id
 * @returns 출처·지문·문항과 쪽 이미지 URL
 * @throws 조회 실패 시
 */
export async function loadReviewData(sourceId: string): Promise<ReviewData> {
  const [source, passages, problems] = await Promise.all([
    fetchSource(sourceId),
    fetchPassages(sourceId),
    fetchProblemsOfSource(sourceId),
  ]);

  const itemPages = [...passages.map((p) => p.page_no), ...problems.map((q) => q.page_no)];
  const ocrPages = (source?.ocr_meta?.pages ?? []).filter((n) => Number.isInteger(n) && n >= 1);
  const pages = [...new Set([...itemPages, ...ocrPages])]
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);

  const pageUrls = await signProblemFiles(pages.map((n) => sourcePagePath(sourceId, n)));
  return { source, passages, problems, pageUrls };
}
