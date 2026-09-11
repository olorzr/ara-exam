'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { OptionSelect } from '@/components/ui/option-select';
import { listLocalModels } from '@/lib/ai/codex/localClient';
import type { CodexModel } from '@/lib/ai/codex/protocol';
import { getCodexModelPref, setCodexModelPref } from '@/lib/ai/localModelPref';

/** '계정 기본값' 을 나타내는 센티널. shadcn Select 는 빈 문자열 값을 싫어한다 */
const DEFAULT_VALUE = '__default__';

/** 추론 노력 한글 라벨. 모르는 값은 그대로 보여준다 */
const EFFORT_LABELS: Record<string, string> = {
  none: '없음',
  minimal: '최소',
  low: '낮음',
  medium: '보통',
  high: '높음',
  xhigh: '아주 높음',
  max: '최대',
  ultra: '울트라',
};

interface AiModelSelectProps {
  /** 연결된 브릿지 포트 */
  port: number;
}

/**
 * 모델·추론 노력 선택.
 *
 * 모델 id 를 코드에 박지 않는다 — 계정·요금제마다 쓸 수 있는 모델이 달라서
 * 선생님 PC 의 `model/list` 응답이 유일한 진실이다.
 * 노력(effort)은 **모델을 명시적으로 고른 경우에만** 고를 수 있다.
 * 기본 모델이 무엇인지 모르면 그 모델이 지원하는 노력 목록도 알 수 없기 때문이다.
 */
export default function AiModelSelect({ port }: AiModelSelectProps) {
  const [models, setModels] = useState<CodexModel[] | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [effort, setEffort] = useState<string | null>(null);

  // 저장된 선택과 모델 목록을 **한 번에** 읽는다.
  //
  // 조회 실패(null)와 '모델이 하나도 없음'([])을 구분하는 게 중요하다 —
  // 일시적인 연결 실패로 저장해 둔 선택을 지워 버리면 안 된다.
  // 목록이 왔는데 저장된 모델이 그 안에 없으면(단종·요금제 변경) 조용히 기본값으로 되돌린다.
  // 그대로 두면 생성할 때 turn/start 가 일단 받아들인 뒤 비동기로 실패한다(실측).
  useEffect(() => {
    let alive = true;
    const pref = getCodexModelPref();

    listLocalModels(port).then((list) => {
      if (!alive) return;
      setModels(list);

      const stale = !!list && !!pref.model && !list.some((m) => m.id === pref.model);
      if (stale) {
        setCodexModelPref({ model: null, effort: null });
        setModel(null);
        setEffort(null);
        return;
      }
      setModel(pref.model);
      setEffort(pref.effort);
    });

    return () => {
      alive = false;
    };
  }, [port]);

  const handleModel = useCallback((value: string) => {
    const next = value === DEFAULT_VALUE ? null : value;
    // 모델이 바뀌면 지원 노력 목록도 달라진다 — 옛 값을 남기면 무효값이 전송된다
    setCodexModelPref({ model: next, effort: null });
    setModel(next);
    setEffort(null);
    toast.success('모델을 저장했어요.');
  }, []);

  const handleEffort = useCallback(
    (value: string) => {
      const next = value === DEFAULT_VALUE ? null : value;
      setCodexModelPref({ model, effort: next });
      setEffort(next);
      toast.success('추론 노력을 저장했어요.');
    },
    [model],
  );

  if (!models) return null;

  const selected = models.find((m) => m.id === model);
  const efforts = selected?.supportedReasoningEfforts ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="ai-model">모델</Label>
        <OptionSelect
          id="ai-model"
          value={model ?? DEFAULT_VALUE}
          options={[
            { value: DEFAULT_VALUE, label: '계정 기본값' },
            ...models.map((m) => ({ value: m.id, label: m.displayName || m.id })),
          ]}
          onChange={handleModel}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-effort">추론 노력</Label>
        <OptionSelect
          id="ai-effort"
          value={effort ?? DEFAULT_VALUE}
          disabled={!selected || efforts.length === 0}
          options={[
            { value: DEFAULT_VALUE, label: '모델 기본값' },
            ...efforts.map((e) => ({
              value: e.reasoningEffort,
              label: EFFORT_LABELS[e.reasoningEffort] ?? e.reasoningEffort,
            })),
          ]}
          onChange={handleEffort}
        />
        {!selected && (
          <p className="text-xs text-gray-500">모델을 고르면 노력도 선택할 수 있어요.</p>
        )}
      </div>
    </div>
  );
}
