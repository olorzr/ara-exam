'use client';

import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PaperComposeBody from '@/components/problem-paper/PaperComposeBody';
import { usePaperComposer } from '@/hooks/usePaperComposer';
import { usePaperCreateSave } from '@/hooks/usePaperCreateSave';
import { fireGradeSync } from '@/lib/grade-sync-client';
import { PageTitle } from '@/components/magazine';

interface PaperComposeScreenProps {
  /**
   * 평가문제집을 보이는가 — 책 만들기의 문제지 만들기(`/books/papers/new`)만 켠다.
   * 문제 은행의 문제지 조합은 다른 유형만 본다(2026-11-05 "책 만들 때 빼고는 안 쓸 거라서").
   */
  withWorkbook?: boolean;
}

/**
 * 문제지 만들기 화면 — 문제 은행(`/problems/papers/new`)과 책 만들기(`/books/papers/new`)가 **같은 화면**을 쓴다.
 * 몸통(트리·목록·캔버스)은 고치기 화면과 같은 `PaperComposeBody` 이고, 여기는 머리와 '문제지 만들기' 저장뿐이다.
 * @param props - 평가문제집을 보이는지
 * @returns 조합 화면
 */
export default function PaperComposeScreen({ withWorkbook = false }: PaperComposeScreenProps) {
  const router = useRouter();
  const paper = usePaperComposer();
  const create = usePaperCreateSave(paper);

  const handleSave = async () => {
    const id = await create.save();
    if (!id) return;
    // OMR 문제지는 학원 성적에 시험으로 등록한다(실패하면 경고 토스트 — 상세 화면에서 다시 보낼 수 있다)
    if (paper.settings.omr) fireGradeSync('/api/sync-paper-to-grades', { paperId: id });
    // ⚠️ 등록은 기다리지 않으므로 '등록했어요' 라고 말하지 않는다 — 실패하면 경고 토스트가 따로 뜬다
    toast.success(paper.settings.omr ? '문제지를 만들었어요. 학원 성적에도 등록하는 중이에요.' : '문제지를 만들었어요.');
    router.push(`/problems/papers/${id}`);
  };

  const header = (
    <div className="border-b border-ink pb-3">
      <PageTitle eyebrow={withWorkbook ? 'BOOKS' : 'PROBLEM BANK'} size="sm">{withWorkbook ? '문제지 만들기' : '문제지 조합'}</PageTitle>
      <p className="mt-1 text-sm text-gray-500">
        왼쪽 트리에서 단원·학교·작품·문법을 고르고, 문항을 끌어다 오른쪽에 놓으세요.
        고른 폴더를 <strong>통째로 담거나</strong>, 체크해서 여럿을, 또는
        <strong> 유형 비율</strong>(객관식 8 : 주관식 2 같은)로 무작위로 담을 수도 있어요.
        같은 지문의 문항은 자동으로 붙습니다.
        다른 문제지에 이미 담은 문항이나 정답이 없는 문항은 빼고 볼 수 있어요.
        만든 뒤에도 문제지 화면의 &lsquo;수정&rsquo; 으로 순서를 바꾸거나 문항을 넣고 뺄 수 있어요.
      </p>
      {withWorkbook && (
        <p className="mt-1 text-sm text-gray-500">
          평가문제집 문항은 여기서만 보여요. 만든 문제지는 내지 만들기의 장 담기에서 고르세요.
        </p>
      )}
    </div>
  );

  return (
    <PaperComposeBody
      withWorkbook={withWorkbook}
      paper={paper}
      header={header}
      saving={create.saving}
      onSave={handleSave}
    />
  );
}
