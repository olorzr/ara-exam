'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OWNER_SCOPE_LABELS, OWNER_SCOPES, parseOwnerScope, type OwnerScope,
} from '@/lib/owner-scope';

interface OwnerScopeTabsProps {
  value: OwnerScope;
  onChange: (scope: OwnerScope) => void;
  /** 고른 탭의 목록 */
  children: ReactNode;
}

/**
 * '내가 만든 것 / 다른 선생님이 만든 것' 탭 — 문제지 조합·학교 프린트 시험지 목록이 쓴다.
 *
 * 두 탭이 보여 주는 것은 **같은 목록의 다른 조회**라 목록은 한 벌이다. 그래도 패널은 탭마다
 * `TabsContent` 로 둔다 — 탭과 패널이 ARIA 로 이어져야 스크린리더가 무엇을 여는지 안다
 * (ArchiveSidePanel 과 같은 규약). 목록은 고른 탭의 패널에만 그린다.
 */
export function OwnerScopeTabs({ value, onChange, children }: OwnerScopeTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const scope = parseOwnerScope(next);
        if (scope) onChange(scope);
      }}
    >
      <TabsList>
        {OWNER_SCOPES.map((scope) => (
          <TabsTrigger key={scope} value={scope} className="px-3">
            {OWNER_SCOPE_LABELS[scope]}
          </TabsTrigger>
        ))}
      </TabsList>
      {OWNER_SCOPES.map((scope) => (
        <TabsContent key={scope} value={scope}>
          {scope === value ? children : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
