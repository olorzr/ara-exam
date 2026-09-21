interface ExamPrintHeaderProps {
  title: string;
  /**
   * 출처(단원) 라벨 목록. 단어 시험지는 카테고리 이름을 싣고, **기출 문제지 인쇄물은
   * 하나도 싣지 않는다**(문제지·교사용·답지 셋 다 — 2026-09-19, 사용자 결정.
   * 출처는 문항마다 그 자리에 찍고 머리글에는 모으지 않는다)
   */
  sourceLabels?: string[];
  /**
   * 합격 기준. **주지 않으면 그 줄을 그리지 않는다** —
   * 기출 문제지에는 합격선 개념이 없다(단어 시험지에만 있다).
   */
  passCount?: number;
  passPercentage?: number;
  /** 이름·날짜·점수란 — 정답을 싣는 인쇄물(교사용·답지)에서는 숨긴다 */
  showScoreRow?: boolean;
  /** 점수란 분모 (총 문항 수) */
  totalCount?: number;
  /**
   * 학생이 쓸 90A 답안지 장수. **2 이상일 때만** 표시한다 —
   * 기성 용지라 장 번호가 인쇄돼 있지 않아 몇 장을 받아야 하는지 시험지가 알려야 한다.
   */
  answerSheetCount?: number;
}

/**
 * 시험지·답안지 1페이지 상단 전체 헤더 (제목 + 로고 + 정보 바).
 * 주관식/객관식/객관식 답안지가 같은 마크업을 쓰도록 한 곳에 모았다.
 */
export default function ExamPrintHeader({
  title,
  sourceLabels = [],
  passCount,
  passPercentage,
  showScoreRow = false,
  totalCount = 0,
  answerSheetCount = 0,
}: ExamPrintHeaderProps) {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  // 아랫줄(출처·합격선)에 그릴 것이 있는가
  const hasSourceRow = sourceLabels.length > 0 || (passCount !== undefined && passPercentage !== undefined);
  // ⚠️ 빈 정보 바를 그리지 않는다 — 출처를 뺀 정답표는 이 바에 담을 것이 하나도 없어서
  //    내용 없는 민트색 이중 테두리 띠만 인쇄됐다(코덱스 리뷰)
  const hasInfoBar = showScoreRow || hasSourceRow;

  return (
    <>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[18px] font-extrabold text-gray-900 leading-tight">{title}</h2>
          <p className="text-[10px] text-gray-400 mt-0.5 tracking-widest">아라국어논술</p>
        </div>
        {/* 인쇄에서 지연 로딩으로 로고가 빠지지 않도록 next/image 대신 img 를 쓴다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="아라국어논술" width={52} height={52} className="object-contain" />
      </div>

      {hasInfoBar && (
        <div className="border-t-[1.5px] border-b-[1.5px] border-[#B8EDE8] py-2.5 mb-4">
          {showScoreRow && (
            // 아랫줄이 없으면 그 사이 여백도 없어야 한다
            <div className={`flex items-center gap-8 text-[11px] text-gray-600${hasSourceRow ? ' mb-2' : ''}`}>
              <span>
                이름 <span className="inline-block border-b border-gray-400 w-28 ml-2" />
              </span>
              <span>
                날짜 <span className="ml-2 text-gray-800">{today}</span>
              </span>
              {answerSheetCount > 1 && (
                <span className="text-gray-800 font-semibold">답안지 {answerSheetCount}장</span>
              )}
              <span className="ml-auto exam-score-box">
                <span className="inline-block border-b border-gray-400 w-10 text-center" />
                <span className="text-gray-800 font-bold"> / {totalCount}개</span>
              </span>
            </div>
          )}
          {hasSourceRow && (
            <div className="flex justify-between text-[11px] text-gray-500">
              <div className="flex flex-col gap-0.5">
                {sourceLabels.map((label, i) => (
                  <span key={i} className="text-gray-800 font-medium">
                    {label}
                  </span>
                ))}
              </div>
              {passCount !== undefined && passPercentage !== undefined && (
                <span className="self-end">
                  합격 <strong className="text-gray-800">{passCount}개</strong> 이상 ({passPercentage}%)
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
