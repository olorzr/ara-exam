'use client';

import { Button } from '@/components/ui/button';

interface PassageAddButtonProps {
  passageId: string;
  busy: boolean;
  disabled: boolean;
  onAdd: (passageId: string) => void;
}

/**
 * 지문 묶음 머리의 '이 지문 담기'.
 *
 * 지문에 딸린 문항은 **함께 담아야** 쓸모가 있다 — 문제지는 같은 지문의 문항이 붙어 있어야
 * 저장되고(`isContiguous`), 하나만 담으면 나머지는 잊힌다.
 *
 * ⚠️ 개수를 적지 않는다. 담는 것은 **그 지문의 문항 전부**인데(보이는 행이 아니다) 그 수는
 *    조회해 봐야 알고, 보이는 수를 적으면 실제로 담기는 수와 어긋난다 — 몇 개가 들어갔는지는
 *    담은 뒤 토스트가 말해 준다.
 */
export default function PassageAddButton({
  passageId, busy, disabled, onAdd,
}: PassageAddButtonProps) {
  return (
    <Button
      type="button" variant="outline" size="sm" className="text-xs"
      disabled={disabled}
      // 목록에 안 보이는 문항까지 담는다는 것을 손끝에도 남긴다 — 머리의 '문항 N' 은
      // **이 목록에 보이는** 수라 둘이 다를 수 있다
      title="지금 조건에 안 걸렸거나 다음 쪽에 있는 문항까지, 이 지문의 문항을 모두 담아요."
      onClick={() => onAdd(passageId)}
    >
      {busy ? '담는 중…' : '이 지문 전체 담기'}
    </Button>
  );
}
