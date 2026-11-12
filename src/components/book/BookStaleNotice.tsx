'use client';

interface BookStaleNoticeProps {
  /** 무엇이 바뀌었을 수 있는지 — 화면마다 다르다 */
  message: string;
}

/**
 * 열어 둔 책 화면이 믿고 있는 값(담긴 문제지·쪽 수)이 다른 곳에서 바뀌었다는 안내 — **인쇄물에도 찍힌다**.
 * 부르는 쪽이 펼침면·내지 대신 이것만 그리므로 Cmd/Ctrl+P 로 뽑아도 이 안내만 나간다(sql/103 고치기, 코덱스 5·6R).
 * @param props - 안내 문구
 * @returns 안내 띠
 */
export default function BookStaleNotice({ message }: BookStaleNoticeProps) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button" data-no-print onClick={() => window.location.reload()}
        className="rounded-full border border-red-300 px-3 py-1 text-sm hover:bg-red-100"
      >
        새로 고치기
      </button>
    </div>
  );
}
