'use client';

import { useCallback, useState } from 'react';
import type { BookletDuplex } from '@/lib/print/booklet';
import {
  readBookletDuplex, readPaperPrintLayout, readPaperTrimWorks,
  writeBookletDuplex, writePaperPrintLayout, writePaperTrimWorks,
  type PaperPrintLayout,
} from '@/lib/problem-paper/print-layout-pref';

/**
 * 문제지 인쇄 화면의 기억해 두는 선택 셋 — 인쇄 방식(낱장·중철), 중철의 양면 넘김 방향(짧은 쪽·긴 쪽),
 * '복합 지문은 묻는 작품만 인쇄'.
 *
 * 처음 값은 lazy 초기화로 읽는다 — 효과에서 읽으면 `react-hooks/set-state-in-effect` 에 걸리고,
 * 이 앱은 로그인 게이트 때문에 페이지 내용이 서버에서 그려지지 않아 수화가 어긋날 자리도 없다.
 * @returns 지금 값과 바꾸는 함수(바꾸면 브라우저에 남긴다)
 */
export function usePaperPrintPrefs() {
  const [printLayout, setPrintLayout] = useState<PaperPrintLayout>(readPaperPrintLayout);
  const [bookletDuplex, setBookletDuplex] = useState<BookletDuplex>(readBookletDuplex);
  const [trimWorks, setTrimWorks] = useState<boolean>(readPaperTrimWorks);

  const changePrintLayout = useCallback((next: PaperPrintLayout) => {
    setPrintLayout(next);
    writePaperPrintLayout(next);
  }, []);

  const changeBookletDuplex = useCallback((next: BookletDuplex) => {
    setBookletDuplex(next);
    writeBookletDuplex(next);
  }, []);

  const changeTrimWorks = useCallback((on: boolean) => {
    setTrimWorks(on);
    writePaperTrimWorks(on);
  }, []);

  return {
    printLayout, changePrintLayout, bookletDuplex, changeBookletDuplex, trimWorks, changeTrimWorks,
  };
}
