'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { countUnadded } from '@/lib/problem-paper/bulk-add';
import type { ArchiveRow } from '@/hooks/useProblemArchive';
import type { Problem, ProblemSource } from '@/types/problem-bank';

interface ProblemDetailActionsProps {
  /** 지금 보고 있는 문항 (형제를 눌러 옮겨 다닐 수 있다) */
  shown: Problem;
  source: ProblemSource;
  /** 같은 지문의 문항 전부 (자기 자신 포함). 지문이 없으면 자기 하나뿐 */
  siblings: Problem[];
  /** 문제지에 담기 — **문제지 조합 화면만** 넘긴다. 없으면 담기 단추가 아예 없다 */
  onAdd?: (rows: ArchiveRow[]) => void;
  /** 이미 담긴 문항 id */
  addedIds?: ReadonlySet<string>;
}

/**
 * 상세 창 아래의 조작 줄.
 *
 * 링크(편집·검수)는 늘 있고, **담기 단추는 `onAdd` 를 받았을 때만** 나온다 — 아카이브에는
 * 담을 캔버스가 없으므로 그 화면에서는 단추가 보이지 않는다.
 *
 * 담기가 둘인 까닭: 지문에 딸린 문항은 **혼자 담아 봐야 쓸모가 적다.** `[22~23]` 지문의
 * 22번만 담으면 23번은 다른 문제지로 가거나 잊힌다. 그래서 '이 지문의 문항 N개' 를 한 번에
 * 담는 길을 나란히 둔다(문제지는 같은 지문의 문항이 **붙어 있어야** 저장된다).
 *
 * ⚠️ 토스트는 여기서 띄우지 않는다 — 담는 길이 셋(체크 담기·묶음 담기·여기)인데 각자
 *    알리면 같은 일에 화면마다 다른 말을 하게 된다. 알림은 `usePaperBulkAdd.addRows` 한 곳이다.
 */
export default function ProblemDetailActions({
  shown, source, siblings, onAdd, addedIds,
}: ProblemDetailActionsProps) {
  const alreadyAdded = addedIds?.has(shown.id) ?? false;
  const passageRows = siblings.length > 1 ? siblings : [];
  const restCount = countUnadded(passageRows.map((p) => p.id), addedIds);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
      <Link href={`/problems/edit/${shown.id}`} className="text-primary underline underline-offset-2">
        문항 편집
      </Link>
      <Link
        href={`/problems/sources/${source.id}?item=${shown.id}`}
        className="text-primary underline underline-offset-2"
      >
        검수 화면에서 보기
      </Link>

      {onAdd && (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {passageRows.length > 0 && (
            <Button
              type="button" variant="outline" size="sm"
              disabled={restCount === 0}
              onClick={() => onAdd(passageRows.map((p) => ({ ...p, source })))}
            >
              {restCount === 0 ? '이 지문 모두 담김' : `이 지문의 문항 ${restCount}개 담기`}
            </Button>
          )}
          <Button
            type="button" size="sm"
            disabled={alreadyAdded}
            onClick={() => onAdd([{ ...shown, source }])}
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="ml-1">{alreadyAdded ? '담김' : '문제지에 담기'}</span>
          </Button>
        </div>
      )}
    </div>
  );
}
