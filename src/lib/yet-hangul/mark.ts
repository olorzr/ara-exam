import { createHost } from '@/lib/print/table-dom';
import { hasYetHangul } from './detect';

/**
 * 옛한글 글꼴을 **옛 글자가 든 자리에만** 걸도록 HTML 에 표시를 붙인다.
 *
 * 원장님(2026-11-06): "글씨체가 다른 건 알겠는데 다 볼드체가 되어 있네. 어느 학교 기출인지 써 있는 거나 선지까지
 * 굵기 처리가 되어 있어서 너무 이상해." 예전에는 클래스를 문항 뿌리에 달아 출처 줄·번호·현대어 선지까지 나눔 옛한글로
 * 바뀌었다. 그 글꼴은 Regular 한 벌뿐인데 획이 Pretendard 400 보다 굵고, 700 을 청하는 자리는 가짜 굵게로 합성된다.
 * 넓은 글꼴이 된 긴 점선은 발문 상자를 옆 단까지 밀어내기도 했다(남신의주 41번).
 *
 * ⚠️ **데이터에 저장하지 않고 그릴 때 붙인다**(각주 `markFootnotes` 와 같은 규약). 정화기는 class 를 받지 않으므로
 *    **정화한 뒤에** 부르고 결과를 다시 정화하지 않는다. 옛 문제지·책 스냅샷에도 곧바로 적용된다.
 * ⚠️ 각주 표시 **뒤에** 부른다. 각주 표시는 문단을 새로 만들어 줄을 옮기므로, 먼저 표시하면 새 문단이 빠진다.
 * ⚠️ 지문은 쓰지 않는다 — 옛한글 지문은 통째로 명조로 그린다(`yet-hangul-serif`, 교과서 관례).
 */

/** globals.css 의 `.yet-hangul` 과 짝이다 */
export const YET_HANGUL_CLASS = 'yet-hangul';

/**
 * 글꼴을 거는 가장 작은 블록. 정화기가 받는 블록 태그 가운데 글을 직접 담는 것들이다.
 * `blockquote`·표·목록은 그릇이라 빠진다 — 그릇에 걸면 상자 말머리와 옆 문단까지 글꼴이 바뀐다.
 */
const LEAF_SELECTOR = 'p, li, td, th, h3, h4';

/** 옛 글자가 든 글자 노드들 — 고치는 동안 훑지 않으려고 먼저 모은다 */
function yetTextNodes(host: HTMLElement): Text[] {
  const walker = host.ownerDocument.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text && hasYetHangul(node.data)) nodes.push(node);
  }
  return nodes;
}

/**
 * 글자 노드 하나를 표시한다 — 가장 안쪽 블록에, 블록이 없으면(옛 손입력 발문의 날글자) 그 글자만 span 으로.
 * @param node - 옛 글자가 든 글자 노드
 * @returns 손댔으면 true
 */
function markNode(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent || parent.closest(`.${YET_HANGUL_CLASS}`)) return false;
  const leaf = parent.closest(LEAF_SELECTOR);
  if (leaf) {
    leaf.classList.add(YET_HANGUL_CLASS);
    return true;
  }
  const span = node.ownerDocument.createElement('span');
  span.className = YET_HANGUL_CLASS;
  parent.insertBefore(span, node);
  span.appendChild(node);
  return true;
}

/**
 * 정화한 발문·해설 HTML 에서 옛 글자가 든 블록에 글꼴 표시를 붙인다.
 * @param html - **정화가 끝난** HTML
 * @returns 표시가 붙은 HTML. 옛 글자가 없거나 브라우저가 아니면 들어온 글자 그대로
 */
export function markYetHangul(html: string): string {
  if (!hasYetHangul(html)) return html;
  const host = createHost(html);
  if (!host) return html;
  const changed = yetTextNodes(host).map(markNode).some(Boolean);
  return changed ? host.innerHTML : html;
}

/**
 * 선지·표 칸·답처럼 React 가 그리는 자리의 글꼴 클래스.
 * @param text - 그 자리의 글(HTML 이어도 된다)
 * @returns 옛 글자가 있으면 `yet-hangul`, 없으면 undefined(`className` 에 그대로 넘긴다)
 */
export function yetHangulClass(text: string): string | undefined {
  return hasYetHangul(text) ? YET_HANGUL_CLASS : undefined;
}
