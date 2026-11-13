'use client';

import { useRouter } from 'next/navigation';
import { Trash2, FileText, Calendar, CornerDownRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

  return (
    <div className="space-y-0">
      {/* 원본 시험 카드 — 클릭 시 시험지 보기로 이동 */}
      <div
        className={`group relative bg-white border rounded-xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer ${selected ? 'border-primary ring-1 ring-primary/30' : 'border-gray-200'}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-3">
          {selectMode && onToggleSelect && (
            <div className="shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={() => onToggleSelect(exam.id)}
                aria-label={`${exam.title} 선택`}
              />
            </div>
          )}
          <div className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate pr-24">{exam.title}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
              <Calendar className="h-3 w-3 text-gray-300" />
              <span>{formatDateKR(exam.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Badge variant="muted">
            {exam.total_questions}문항
          </Badge>
          <Badge variant="ok">
            합격 {exam.pass_count}개 ({exam.pass_percentage}%)
          </Badge>
        </div>

        {!selectMode && (
          <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onRetest(exam.id); }}
              disabled={retesting}
              className="px-2.5 py-1 rounded-md text-xs font-semibold hover:bg-primary/10 text-primary border border-primary/30 transition-colors disabled:opacity-50"
              aria-label="재시험지 생성"
            >
              {retesting ? '생성중...' : '재시험'}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(exam.id); }}
              className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
              aria-label="시험지 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* 재시험 스레드 */}
      {retakes.length > 0 && (
        <div className="ml-6 border-l-2 border-primary/30 pl-4 space-y-2 pt-2">
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
      className="group relative flex items-center gap-3 bg-gray-50/60 border border-gray-200 rounded-lg px-4 py-3 hover:bg-white hover:shadow-sm transition-all duration-200 cursor-pointer"
      onClick={() => router.push(`/exam/view?id=${retake.id}`)}
    >
      <CornerDownRight className="h-4 w-4 text-gray-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            재시험 {retake.retake_number}차
          </span>
          <span className="text-xs text-gray-400">{formatDateKR(retake.created_at)}</span>
        </div>
        <div className="flex gap-1.5 mt-1">
          <Badge variant="muted">
            {retake.total_questions}문항
          </Badge>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(retake.id); }}
          className="p-1 rounded-md hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
          aria-label="재시험지 삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
