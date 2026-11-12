'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { issueLines } from './issue-lines';

/** 날짜는 바깥 저장소가 아니라 지금 시각이다 — 구독할 것이 없다 */
const subscribe = () => () => undefined;
/** 브라우저의 오늘 — 같은 달이면 같은 글자라 다시 그리지 않는다 */
const clientSnapshot = () => issueLines(new Date()).join('\n');
/** 서버·정적 사전 렌더 때는 비운다(빌드한 날의 달로 굳지 않게) */
const serverSnapshot = () => '';

interface IssueStampProps {
  /** 정해 둔 날짜(테스트·미리보기). 없으면 브라우저의 오늘 */
  date?: Date;
  className?: string;
}

/**
 * 잡지 머리띠 오른쪽 위의 호수 두 줄(NO. 11 / 2026 NOVEMBER).
 *
 * 로그인 화면은 정적으로 미리 그려 두므로 렌더에서 `new Date()` 를 바로 쓰면 **빌드한 날의 달**로
 * 굳는다(`suppressHydrationWarning` 은 하이드레이션 때 글자를 바꾸지도 않는다). 그래서 서버 몫은 비워 두고
 * 브라우저에서 오늘 날짜로 채운다(`useSyncExternalStore` 의 서버·브라우저 값 — 효과 안 setState 없이).
 * 꾸밈 글자라 화면 읽기 프로그램에는 숨긴다. 두 줄 높이를 미리 잡아 채워질 때 흔들리지 않는다.
 * @param props - 정해 둔 날짜·클래스
 * @returns 호수 두 줄
 */
export default function IssueStamp({ date, className }: IssueStampProps) {
  const live = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const text = date ? issueLines(date).join('\n') : live;
  return (
    <p
      aria-hidden="true"
      className={cn(
        'min-h-[3.2em] text-right font-label font-medium leading-[1.6] tracking-[0.14em] whitespace-pre-line text-ink',
        className,
      )}
    >
      {text}
    </p>
  );
}
