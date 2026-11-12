'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { IssueStamp } from '@/components/magazine';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_request: '인증 요청이 올바르지 않습니다. 다시 시도해주세요.',
  token_failed: '네이버 웍스 인증에 실패했습니다. 다시 시도해주세요.',
  user_info_failed: '사용자 정보를 가져오지 못했습니다.',
  unauthorized_domain: '@araeducation.co.kr 계정만 사용할 수 있습니다.',
  create_user_failed: '사용자 등록에 실패했습니다. 관리자에게 문의해주세요.',
  session_failed: '로그인 세션 생성에 실패했습니다. 다시 시도해주세요.',
  verification_failed: '인증 검증에 실패했습니다. 다시 시도해주세요.',
  invalid_callback: '잘못된 인증 콜백입니다. 다시 시도해주세요.',
};

/**
 * 에러 메시지를 표시하는 내부 컴포넌트.
 */
function ErrorMessage() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? '알 수 없는 오류가 발생했습니다.' : null;

  if (!errorMessage) return null;

  return <p className="text-center text-sm font-semibold text-red-700">{errorMessage}</p>;
}

/**
 * 로그인 페이지. 네이버 웍스 OAuth로 로그인한다.
 * 민트 책상 위에 흰 종이 한 장 — 위아래 잉크 줄, 잡지 머리띠 같은 제호(2026-11-12).
 * 네이버 웍스 단추는 그쪽 상표색(녹색) 그대로 둔다.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <main className="w-full max-w-md border-y-2 border-ink bg-card px-8 pt-5 pb-8 text-center sm:px-9">
        <div className="flex items-start justify-between gap-3">
          <p aria-hidden="true" className="text-left font-display text-[12.5px] leading-[1.45] text-ink">
            Exam Desk<br />Teacher&apos;s Workroom
          </p>
          {/* 이 화면은 정적으로 미리 그려진다 — 호수는 브라우저에서 오늘 날짜로 채운다(IssueStamp) */}
          <IssueStamp className="text-[10px]" />
        </div>
        <Image src="/logo.png" alt="" width={64} height={64} className="mx-auto mt-6" priority />
        <h1
          className="mt-3.5 mb-3 text-[40px] leading-[1.1] font-bold tracking-[-0.02em] text-ink"
          style={{ fontFamily: "'Gmarket Sans', sans-serif" }}
        >
          아라국어논술
        </h1>
        <hr className="mx-auto w-28 border-0 border-t border-gray-200" />
        <p className="mt-3 pl-[0.5em] font-display text-sm tracking-[0.5em] text-ink">시험 관리 시스템</p>
        <p className="mt-1.5 text-[13px] text-gray-500">선생님 전용 🌷</p>

        <hr className="mt-6 mb-5 border-0 border-t-2 border-dotted border-ink" />

        <div className="space-y-3">
          <Suspense>
            <ErrorMessage />
          </Suspense>
          <a
            href="/api/auth/naver-works"
            className="flex min-h-12 w-full items-center justify-center rounded-full bg-[#03C75A] text-[15px] font-bold text-white transition-colors hover:bg-[#02b351]"
          >
            네이버 웍스로 로그인
          </a>
          <p className="text-center text-[12.5px] text-gray-500">
            @araeducation.co.kr 계정만 로그인할 수 있습니다
          </p>
        </div>
      </main>
    </div>
  );
}
