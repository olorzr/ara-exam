/**
 * 저장하지 않는 화면을 떠날 때 물어볼지 판정한다 (순수 함수).
 *
 * Next.js 앱 라우터에는 화면 전환을 막을 방법이 없고, 링크를 눌러 옮겨 가는 길에서는
 * `beforeunload` 가 **아예 발화하지 않는다** — 문서를 떠나는 것이 아니기 때문이다.
 * 그래서 링크 누름을 가로채 판정하고, 그 판정만 여기 순수 함수로 떼어 둔다.
 */

/** 눌린 링크에서 판정에 필요한 것만 */
export interface NavLinkInfo {
  /** 절대 URL (`HTMLAnchorElement.href` 가 주는 모양) */
  href: string;
  /** `target` 속성 ('_blank' 면 지금 화면은 그대로 남는다) */
  target: string;
  /** 내려받기 링크인가 */
  download: boolean;
}

/** 누를 때 눌려 있던 보조키 — 새 탭·새 창으로 열리므로 지금 화면은 남는다 */
export interface NavClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * 이 링크 누름이 **지금 화면을 떠나게** 하는가.
 * @param link - 눌린 링크
 * @param click - 눌린 보조키
 * @param currentHref - 지금 주소 (절대 URL)
 * @returns 화면을 떠나면 true (막고 물어볼 자리)
 */
export function leavesCurrentPage(
  link: NavLinkInfo,
  click: NavClickModifiers,
  currentHref: string,
): boolean {
  if (link.download) return false;
  if (link.target && link.target !== '_self') return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;

  let next: URL;
  let now: URL;
  try {
    next = new URL(link.href, currentHref);
    now = new URL(currentHref);
  } catch {
    return false;
  }
  // 다른 사이트로 나가는 것은 문서를 떠나는 일이라 beforeunload 가 맡는다
  if (next.origin !== now.origin) return false;
  // 같은 쪽 안의 앵커(#…)는 화면이 그대로다
  return next.pathname !== now.pathname || next.search !== now.search;
}
