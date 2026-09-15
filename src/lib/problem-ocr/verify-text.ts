import { textOf } from './merge-keys';
import type { MergeResult } from './merge';
import type { PageText } from './page-text';
import { itemTargetLabel, type OcrWarning, type OcrWarningTarget } from './warnings';
import { hasYetHangul } from '@/lib/yet-hangul';

/**
 * 읽어 낸 글을 **PDF 에 박힌 글자와 대조한다** (순수 함수).
 *
 * 참고 텍스트가 있는 쪽에서만 돈다(기출은 대부분 스캔본이라 드물다). 여기서 걸리는 것은
 * 모델이 글자를 **지어냈거나 통째로 빠뜨린** 경우다 — 오탈자 하나가 아니라 문장 단위로
 * 어긋난 것만 잡는다.
 *
 * ⚠️ **확실할 때만 말한다.** 시험지의 글자 레이어에는 읽는 순서가 어긋나거나 글꼴 탓에
 *    붙어 나오는 대목이 흔하다. 문턱을 낮게 잡으면 멀쩡한 문항에 경고가 줄줄이 붙어
 *    경고 전체를 못 믿게 된다.
 *
 * ⚠️ **옛한글로 읽어 낸 항목은 견주지 않는다.** 글자 레이어는 한양 PUA(→ `〔옛〕`)로, 모델은
 *    첫가끝 자모로 같은 글을 적으므로 조각이 절대 맞지 않는다 — 맞게 읽은 중세국어 지문마다
 *    '다르다' 고 짚게 된다. 그 쪽에는 이미 '옛한글이 있어요' 경고가 붙어 대조를 부탁한다.
 *
 * ⚠️ 건너뛰는 기준은 **그 항목의 본문**이지 쪽이 아니다(코덱스 리뷰 1R). 참고 텍스트 쪽을
 *    보고 건너뛰면 옛한글 지문 하나가 **그 쪽의 현대 문항 검사까지 통째로** 끈다.
 *    참고 텍스트에 옛 글자가 섞여 있어도 현대 문항의 조각은 그대로 찾아지므로 걸림돌이 아니고,
 *    모델이 옛 글을 **현대 글자로 뭉개 적은** 경우는 오히려 이 대조에 걸려야 맞다.
 */

/** 견줄 조각의 길이 (글자). 너무 짧으면 우연히 맞고 너무 길면 줄바꿈 하나에 어긋난다 */
const GRAM = 6;

/** 이 비율 아래로 맞으면 알린다 */
const MIN_MATCH = 0.5;

/** 이보다 짧은 본문은 견주지 않는다 — 표본이 적어 비율이 못 믿을 값이 된다 */
const MIN_LENGTH = 40;

/**
 * 공백·문장부호를 걷어낸 비교용 글자열.
 *
 * ⚠️ NFC 로 먼저 접는다(코덱스 리뷰 1R) — 한쪽이 자모로 갈린 현대 글자(NFD)면 조각이 하나도
 *    안 맞아 멀쩡한 문항에 경고가 붙는다. 옛한글은 접을 완성형이 없어 그대로 남는다.
 */
function compact(text: string): string {
  return text.normalize('NFC').replace(/[\s.,·‧・…"'"'`~!?()[\]{}<>「」『』〈〉《》]/g, '');
}

/**
 * `body` 의 글자 조각 가운데 `source` 안에 있는 비율.
 * @param body - 모델이 옮겨 적은 글
 * @param source - PDF 에 박힌 글자
 * @returns 0~1. 견줄 수 없으면 null
 */
export function matchRatio(body: string, source: string): number | null {
  const a = compact(body);
  const b = compact(source);
  if (a.length < MIN_LENGTH || b.length < MIN_LENGTH) return null;

  let hit = 0;
  let total = 0;
  for (let i = 0; i + GRAM <= a.length; i += GRAM) {
    total += 1;
    if (b.includes(a.slice(i, i + GRAM))) hit += 1;
  }
  return total === 0 ? null : hit / total;
}

/**
 * 읽어 낸 글을 참고 텍스트와 대조해 어긋난 항목을 찾는다.
 * @param merged - 병합이 끝난 지문·문항
 * @param texts - 쪽마다의 참고 텍스트
 * @returns 카드에 붙일 경고들
 */
export function verifyAgainstText(
  merged: Pick<MergeResult, 'passages' | 'problems'>,
  texts: readonly PageText[],
): OcrWarning[] {
  if (texts.length === 0) return [];
  const byPage = new Map(texts.map((t) => [t.page, t.text]));

  const off: OcrWarningTarget[] = [];

  for (const passage of merged.passages) {
    // ⚠️ 여러 쪽에 걸친 지문은 건너뛴다 — 시작 쪽 글자만으로는 뒷부분이 통째로
    //    '안 맞는 글' 로 보인다. 그건 대조가 아니라 착각이다
    if (passage.pageSpan > 1) continue;
    const source = byPage.get(passage.page_no);
    if (!source) continue;
    const body = textOf(passage.html);
    if (hasYetHangul(body)) continue;
    const ratio = matchRatio(body, source);
    if (ratio !== null && ratio < MIN_MATCH) {
      off.push({
        kind: 'passage',
        id: passage.id,
        page: passage.page_no,
        label: itemTargetLabel({ kind: 'passage', page: passage.page_no }),
      });
    }
  }

  for (const problem of merged.problems) {
    const source = byPage.get(problem.page_no);
    if (!source) continue;
    const body = [textOf(problem.stem_html), ...problem.choices.map(textOf)].join(' ');
    if (hasYetHangul(body)) continue;
    const ratio = matchRatio(body, source);
    if (ratio !== null && ratio < MIN_MATCH) {
      off.push({
        kind: 'problem',
        id: problem.id,
        page: problem.page_no,
        label: itemTargetLabel({
          kind: 'problem', page: problem.page_no, number: problem.number,
        }),
      });
    }
  }

  if (off.length === 0) return [];
  return [{
    message: 'PDF 에 박힌 글자와 다른 대목이 있어요. 원본과 맞춰 봐 주세요.',
    targets: off,
  }];
}
