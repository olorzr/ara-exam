'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { BUILD_ID, DEV_BUILD_ID } from '@/lib/build-id';
import {
  alreadyReloadedFor, BUILD_AWAY_MS, BUILD_POLL_MS, BUILD_RECHECK_GAP_MS, decideBuildAction, fetchLatestBuild,
  rememberReloadFor, reloadPage, type BuildCheckTrigger,
} from '@/lib/build-watch';
import { hasWorkInProgress } from '@/lib/work-in-progress';

const NOTICE_ID = 'build-update';

/** 같은 id 라 몇 번을 불러도 안내는 하나다. 닫아도 다음 검사에서 다시 뜬다 */
function showUpdateNotice(): void {
  toast('새 버전이 나왔어요.', {
    id: NOTICE_ID,
    description: '저장할 것을 마치고 새로 고쳐 주세요.',
    duration: Infinity,
    closeButton: true,
    action: { label: '새로 고침', onClick: reloadPage },
  });
}

/**
 * 열어 둔 탭이 옛 배포본의 코드로 계속 도는 일을 끊는다.
 *
 * 문제 은행·문제지 조합은 필터를 `replaceState` 로 적고 데이터를 Supabase 에서 직접 읽어, 그 화면에 머무는 동안에는
 * Next 서버를 한 번도 안 부른다. 그러면 Next 의 '빌드가 다르면 새로 받기' 가 돌 자리가 없어 탭을 닫기 전까지 옛 코드다.
 * 그래서 들어올 때 · 탭으로 돌아올 때 · 보고 있는 동안 10분마다 지금 배포본을 묻는다.
 * 무엇을 할지는 `decideBuildAction` 이 정하고, 말없이 새로 고치는 것은 `BUILD_AWAY_MS` 넘게 비운 탭뿐이다.
 */
export function useBuildWatch(): void {
  useEffect(() => {
    if (BUILD_ID === DEV_BUILD_ID) return undefined;
    let alive = true;
    let asking = false;
    let askedAt = Number.NEGATIVE_INFINITY;
    let awaySince: number | null = null;

    const check = async (trigger: BuildCheckTrigger) => {
      if (asking) return;
      asking = true;
      askedAt = Date.now();
      const latest = await fetchLatestBuild();
      asking = false;
      if (!alive || latest === null) return;
      const action = decideBuildAction({
        current: BUILD_ID,
        latest,
        trigger,
        pathname: window.location.pathname,
        busy: hasWorkInProgress(),
        alreadyReloaded: alreadyReloadedFor(latest),
      });
      if (action === 'notify') showUpdateNotice();
      if (action !== 'reload') return;
      // 적지 못했으면 되돌이를 못 막는다 — 안내로 바꾼다
      if (rememberReloadFor(latest)) reloadPage();
      else showUpdateNotice();
    };

    const onLeave = () => {
      awaySince ??= Date.now();
    };
    const onReturn = () => {
      if (document.visibilityState !== 'visible') {
        onLeave();
        return;
      }
      const now = Date.now();
      const away = awaySince === null ? 0 : now - awaySince;
      awaySince = null;
      if (away >= BUILD_AWAY_MS) void check('return');
      else if (now - askedAt >= BUILD_RECHECK_GAP_MS) void check('poll');
    };
    const onPoll = () => {
      if (document.visibilityState === 'visible') void check('poll');
    };

    void check('mount');
    const timer = window.setInterval(onPoll, BUILD_POLL_MS);
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener('blur', onLeave);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('blur', onLeave);
    };
  }, []);
}
