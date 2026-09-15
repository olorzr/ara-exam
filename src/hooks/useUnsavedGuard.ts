'use client';

import { useEffect } from 'react';
import { leavesCurrentPage } from '@/lib/nav-guard';

/**
 * 저장하지 않는 화면을 떠나기 전에 물어본다.
 *
 * ⚠️ `beforeunload` **하나로는 모자란다.** 사이드바 링크를 눌러 옮겨 가는 길은 문서를
 *    떠나는 것이 아니라 발화하지 않는다 — 만들어 고친 문항이 아무 말 없이 사라진다.
 *    그래서 링크 누름을 **잡아채는 단계**에서 한 번 더 확인한다(라우터에 막을 방법이 없다).
 *
 * ⚠️ **닿지 못하는 길이 남아 있다**: 브라우저 뒤로 가기와 링크가 아닌 단추(로그아웃)다.
 *    뒤로 가기를 막으려면 히스토리에 가짜 항목을 밀어 넣고 `popstate` 에서 되밀어야 하는데,
 *    그 방식은 어긋나면 **사용자를 화면에 가둔다** — 막으려던 손실보다 나쁘다.
 *    그래서 화면 쪽이 '저장되지 않는다' 를 문항이 있는 동안 **계속 보여 주는** 것으로 메운다.
 * @param active - 지킬 것이 있는가 (없으면 아무 일도 하지 않는다)
 * @param message - 확인 창에 띄울 말
 */
export function useUnsavedGuard(active: boolean, message: string): void {
  useEffect(() => {
    if (!active) return undefined;

    const warnUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const warnNavigate = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const anchor = (e.target as Element | null)?.closest?.('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href) return;

      const leaving = leavesCurrentPage(
        { href: anchor.href, target: anchor.target, download: anchor.hasAttribute('download') },
        e,
        window.location.href,
      );
      if (!leaving || window.confirm(message)) return;
      // 잡아채는 단계에서 막는다 — 라우터의 누름 처리가 돌기 전이어야 한다
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener('beforeunload', warnUnload);
    document.addEventListener('click', warnNavigate, true);
    return () => {
      window.removeEventListener('beforeunload', warnUnload);
      document.removeEventListener('click', warnNavigate, true);
    };
  }, [active, message]);
}
