import Link from 'next/link';
import { MOCK_EXAM_SOURCE_TYPE } from '@/lib/problem-bank/school-exam-tree';
import { setViewHref } from '@/lib/problem-bank/source-set-link';
import {
  setExamLabel, setIssueNo, setNamesSummary, setTextbookLabel, type SourceSet,
} from '@/lib/problem-bank/source-sets';

interface SetCardProps {
  set: SourceSet;
  /** 카드 번호 (1부터) */
  no: number;
  /** 학교 이름으로 찾는 중이면 맞은 이름을 앞에 세운다 */
  match?: (name: string) => boolean;
}

/**
 * 세트 카드 한 장 — 기출 공유 사이트의 세트 카드(exam-share `SetCard`)를 이 앱의 잡지 꼭지 모양으로 옮겼다.
 *
 * 모양은 대시보드의 번호 꼭지와 같은 유틸리티다(위아래 잉크 줄 · `( SET ) #01` · 점선). 영문 라벨은 꾸밈이라
 * 화면 읽기 프로그램에는 숨기고 한글 이름을 따로 읽힌다. 링크는 미리 받지 않는다 — 카드가 200장을 넘는다.
 */
export default function SetCard({ set, no, match }: SetCardProps) {
  const mock = set.source_type === MOCK_EXAM_SOURCE_TYPE;
  return (
    <li className="flex">
      <Link
        href={setViewHref(set)}
        prefetch={false}
        className="group flex flex-1 flex-col border-y-2 border-ink pt-1.5 pb-3.5 text-ink"
      >
        <span aria-hidden="true" className="flex items-baseline justify-between gap-2">
          <span className="font-label text-[10px] font-medium tracking-[0.18em]">{mock ? '( MOCK )' : '( SET )'}</span>
          <b className="font-label text-xl font-extrabold tracking-[0.02em]">{setIssueNo(no)}</b>
        </span>
        <span className="mt-2 font-label text-[30px] leading-[1.05] font-extrabold tracking-[0.01em] group-hover:text-primary">
          {set.year || '학년도 미지정'}
          <br />
          {set.grade || '학년 미지정'}
        </span>
        <span className="mt-1.5 font-display text-[15px] leading-snug font-bold">{setExamLabel(set)}</span>
        <hr className="my-2.5 border-0 border-t-2 border-dotted border-ink" />
        <span aria-hidden="true" className="font-label text-[10px] font-medium tracking-[0.18em] text-gray-500">
          {mock ? 'BOARD' : 'TEXTBOOK'}
        </span>
        <span className="text-[13px] leading-snug font-semibold">
          <span className="sr-only">{mock ? '주관 ' : '교과서 '}</span>
          {setTextbookLabel(set)}
        </span>
        <span aria-hidden="true" className="mt-1.5 font-label text-[10px] font-medium tracking-[0.18em] text-gray-500">
          {mock ? 'SUBJECTS' : 'SCHOOLS'}
        </span>
        <span className="text-[13px] leading-snug text-gray-600">
          <span className="sr-only">{mock ? '과목 ' : '학교 '}</span>
          {setNamesSummary(set, match)}
        </span>
      </Link>
    </li>
  );
}
