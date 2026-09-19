'use client';

import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { joinWorkTitles, splitWorkTitles, workLabelText } from '@/lib/problem-bank/work-title';
import type { PassageWork } from '@/types/problem-bank';

interface ProblemWorksFieldProps {
  /** 지금 이 문항에 붙은 작품명들. 빈 배열이면 '지문 전체' */
  value: string[];
  onChange: (titles: string[]) => void;
  /**
   * 딸린 지문에 실린 작품들. 있으면 **체크로 고른다**.
   * 지문이 없거나(단독 문항) 아직 못 읽었으면 자유 입력으로 떨어진다.
   */
  passageWorks?: PassageWork[];
}

/**
 * 문항이 **어느 작품을 묻는가**.
 *
 * `(가)(나)` 지문에서는 문항마다 묻는 편이 다르다 — `(나)의 화자는` 은 한 편만,
 * `(가)와 (나)의 공통점은` 은 두 편을 묻는다. 그래서 지문의 작품을 체크로 고른다.
 *
 * ⚠️ **고른 것을 그대로 보낸다**(전부 골랐어도 빈 목록으로 바꾸지 않는다). DB 는 빈 목록을
 *    '지문 전체' 로 읽어 지문의 작품으로 채우는데(sql/33), 그러면 화면이 든 값과 저장된 값이
 *    달라져 **저장하자마자 '저장 안 됨' 배지가 그대로 남는다.**
 * ⚠️ **나중에 지문에 작품이 하나 더 붙어도 자동으로 붙지 않는다** — 작품이 **두 편 이상**이던
 *    지문에서 전체를 묻던 문항만 따라간다(sql/33). 한 편뿐이던 지문에서는 '전체를 묻는다' 와
 *    '그 한 편으로 좁혔다' 가 저장값으로 구별되지 않아, 따라가게 두면 한 편만 묻던 문항까지
 *    말없이 두 편을 묻게 된다. 새로 붙은 작품은 이 칸에서 체크로 붙인다.
 * ⚠️ **하나도 안 고른 상태는 만들 수 없다.** 저장하면 '전체' 로 읽히기 때문이다 — 마지막 한 편은
 *    체크를 끌 수 없게 막아, 껐다고 생각한 것이 저장 뒤 되살아나는 일을 없앤다.
 */
export default function ProblemWorksField({
  value, onChange, passageWorks,
}: ProblemWorksFieldProps) {
  // ⚠️ 자유 입력은 **친 글자를 그대로 들고 있어야 한다.** 목록에서 되만들어 그리면
  //    가운뎃점을 치는 순간 그 글자가 사라져 여러 편을 적을 수가 없다
  const [raw, setRaw] = useState(() => joinWorkTitles(value));

  if (!passageWorks || passageWorks.length === 0) {
    // 지문이 없거나 지문에 작품이 없다 — 손으로 적는다(가운뎃점으로 여러 편)
    return (
      <div className="space-y-1">
        <Label className="text-xs text-gray-500">작품명</Label>
        <Input
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            onChange(splitWorkTitles(e.target.value));
          }}
          className="h-8 text-sm"
          placeholder="여러 편이면 · 로 나눠 적어요"
          aria-label="작품명"
        />
      </div>
    );
  }

  // ⚠️ 지문에 **없는** 작품명도 줄을 세운다. 지문에서 한 편이 빠져도 문항에 좁혀 적어 둔
  //    이름은 DB 가 보존하는데, 안 보여 주면 이 화면에서 저장하는 순간 **말없이 사라진다**
  const extra = value
    .filter((title) => !passageWorks.some((w) => w.title === title))
    .map((title) => ({ label: '', title, author: '' }));
  const rows = [...passageWorks, ...extra];
  const all = rows.map((w) => w.title);
  // 빈 목록은 '전체' 라는 뜻이라 화면에서는 전부 켜 놓는다
  const chosen = value.length === 0 ? all : all.filter((t) => value.includes(t));
  // ⚠️ '지문 전체' 는 **지문의 작품을 빠짐없이, 그것만** 고른 상태다(코덱스 리뷰 2R).
  //    지문에 없는 작품이 하나라도 섞이면 DB 에는 좁힌 목록으로 남아, 나중에 지문에 작품이
  //    붙어도 따라오지 않는다 — 그걸 '전체' 라고 말하면 거짓이 된다
  const wholePassage = passageWorks.every((w) => chosen.includes(w.title))
    && extra.every((w) => !chosen.includes(w.title));

  const toggle = (title: string) => {
    const next = chosen.includes(title)
      ? chosen.filter((t) => t !== title)
      : all.filter((t) => t === title || chosen.includes(t));
    if (next.length === 0) return;
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">묻는 작품</Label>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {rows.map((work) => {
          const on = chosen.includes(work.title);
          const foreign = extra.some((w) => w.title === work.title);
          return (
            <label key={work.title} className="flex items-center gap-1.5 text-sm text-gray-700">
              <Checkbox
                checked={on}
                disabled={on && chosen.length === 1}
                onCheckedChange={() => toggle(work.title)}
                aria-label={`${work.title} 묻기`}
              />
              <span className={foreign ? 'text-amber-700' : undefined}>
                {workLabelText(work)}
                {foreign && <span className="ml-1 text-[11px]">지문에 없음</span>}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400">
        {wholePassage
          ? '지문에 실린 작품 전체를 묻는 문항이에요.'
          : '고른 작품만 묻습니다. 지문의 작품을 전부 고르면 지문 전체가 돼요.'}
      </p>
    </div>
  );
}
