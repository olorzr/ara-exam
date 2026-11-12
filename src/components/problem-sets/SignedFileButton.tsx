'use client';

import { useState, type ReactNode } from 'react';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { openSignedInNewTab } from '@/lib/problem-bank/open-signed';

interface SignedFileButtonProps {
  /** 버킷 기준 경로 */
  path: string;
  children: ReactNode;
}

/** 열기 실패 문구 */
const FAIL_MESSAGE = {
  blocked: '새 탭을 열지 못했어요. 브라우저의 팝업 차단을 풀어 주세요.',
  failed: '파일을 열지 못했어요. 잠시 뒤 다시 눌러 주세요.',
} as const;

/**
 * 저장소 파일을 새 탭으로 여는 단추 — 누를 때 새로 서명한다(`openSignedInNewTab`).
 * 화면을 열 때 받아 둔 서명 주소를 링크에 박지 않는다: 한 시간이면 만료돼 오래 열어 둔 화면의 링크가 오류 쪽을 연다.
 */
export default function SignedFileButton({ path, children }: SignedFileButtonProps) {
  const [opening, setOpening] = useState(false);

  const open = async () => {
    setOpening(true);
    const result = await openSignedInNewTab(path);
    setOpening(false);
    if (result !== 'opened') toast.error(FAIL_MESSAGE[result]);
  };

  return (
    <button
      type="button"
      onClick={() => { void open(); }}
      disabled={opening}
      className="inline-flex items-center gap-1 font-semibold text-ink underline underline-offset-2 disabled:opacity-60"
    >
      <FileText className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}
