'use client';

import { useRouter } from 'next/navigation';
import { Trash2, CornerDownRight } from 'lucide-react';
import { TileHead } from '@/components/magazine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateKR } from '@/lib/format';

interface ExamRecord {
  id: string;
  title: string;
  pass_percentage: number;
  total_questions: number;
  pass_count: number;
  parent_exam_id: string | null;
  retake_number: number;
  created_at: string;
}

interface ExamHistoryCardProps {
  exam: ExamRecord;
  retakes?: ExamRecord[];
  onDelete: (id: string) => void;
  onRetest: (id: string) => void;
  retesting?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

/**
 * 시험지 이력을 카드로 표시하는 컴포넌트. 재시험은 원본 아래 스레드로 표시.
 */
export default function ExamHistoryCard({ exam, retakes = [], onDelete, onRetest, retesting, selectMode, selected, onToggleSelect }: ExamHistoryCardProps) {
  const router = useRouter();

  const handleCardClick = () => {
    if (selectMode && onToggleSelect) {
      onToggleSelect(exam.id);
      return;
    }
    router.push(`/exam/view?id=${exam.id}`);
  };

  // 모양(2026-11-14, 원장님 "학교 프린트 시험지라던가 이런게 디자인이 안 예뻐"): 기출 세트 카드와 같은 잡지 꼭지 —
  // 위아래 잉크 줄 · `( TEST )` · 바탕체 제목 · 점선. 예전엔 그러데이션 아이콘에 그림자가 뜨는 흰 카드였다.
  // ⚠️ 재시험·지우기 단추는 **늘 보인다** — 예전엔 마우스를 올려야 나타나 태블릿·휴대폰에서는 누를 길이 없었다
  return (
    <div className="space-y-2">
      <div
        className={`group relative flex cursor-pointer flex-col border-y-2 border-ink pt-1.5 pb-3.5 text-ink ${selected ? 'bg-accent-soft/50' : ''}`}
        onClick={handleCardClick}
      >
        <TileHead
          label="TEST"
          aside={selectMode && onToggleSelect && (
            <span onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(exam.id)}
                aria-label={`${exam.title} 선택`}
              />
            </span>
          )}
        />
        <h3 className="mt-2 font-display text-[17px] leading-snug font-bold break-keep [overflow-wrap:anywhere] group-hover:text-primary">{exam.title}</h3>
        <p className="mt-1 text-xs text-gray-500">{formatDateKR(exam.created_at)}</p>

        <hr className="my-2.5 border-0 border-t-2 border-dotted border-ink" />
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="muted">{exam.total_questions}문항</Badge>
          <Badge variant="ok">합격 {exam.pass_count}개 ({exam.pass_percentage}%)</Badge>
        </div>

        {/* 단추 묶음이 클릭 전파를 막는다 — 잠긴 단추(생성 중)는 pointer-events-none 이라 클릭이 카드로 넘어가 시험지 보기로 갔다(코덱스 1R) */}
        {!selectMode && (
          <div className="mt-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button" size="sm" variant="outline"
              onClick={(e) => { e.stopPropagation(); onRetest(exam.id); }}
              disabled={retesting}
              aria-label="재시험지 생성"
            >
              {retesting ? '생성중...' : '재시험'}
            </Button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(exam.id); }}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              aria-label="시험지 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* 재시험 스레드 — 원본 꼭지 아래 점선 줄기 */}
      {retakes.length > 0 && (
        <div className="ml-3 space-y-1.5 border-l-2 border-dotted border-ink pl-3">
          {retakes.map((retake) => (
            <RetakeItem key={retake.id} retake={retake} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

interface RetakeItemProps {
  retake: ExamRecord;
  onDelete: (id: string) => void;
}

/** 재시험 스레드 아이템 */
function RetakeItem({ retake, onDelete }: RetakeItemProps) {
  const router = useRouter();

  return (
    <div
      className="group flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-card px-3 py-2"
      onClick={() => router.push(`/exam/view?id=${retake.id}`)}
    >
      <CornerDownRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-ink group-hover:text-primary">재시험 {retake.retake_number}차</span>
          <Badge variant="muted">{retake.total_questions}문항</Badge>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{formatDateKR(retake.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(retake.id); }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        aria-label="재시험지 삭제"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
