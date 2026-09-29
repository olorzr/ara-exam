import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { OwnerScope } from '@/lib/owner-scope';
import type { PrintScanRow } from '@/types/print-scan';

/**
 * 학교 프린트 목록 훅 — 탭(내 것 / 다른 선생님 것)을 오가도 **지금 탭**을 읽는가.
 *
 * 코덱스 1R: 지우기·시험지 만들기가 끝난 뒤의 다시 읽기가 **누를 때의 탭**을 닫아 두고 있어,
 * 그 사이 탭을 바꾸면 옛 탭을 읽고 새 탭의 응답을 버려 새 탭이 영영 '읽는 중' 으로 멈췄다.
 */

const fetchScans = vi.fn<(scope: OwnerScope, userId: string) => Promise<PrintScanRow[]>>();

vi.mock('@/lib/auth-context', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/lib/print-scan/queries', () => ({
  fetchScansWithBundles: (scope: OwnerScope, userId: string) => fetchScans(scope, userId),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

const { usePrintSheetList } = await import('./usePrintSheetList');

const scan = (id: string): PrintScanRow => ({
  id, title: id, file_path: '', page_count: 0, user_id: 'me', updated_by: null,
  created_at: '', updated_at: '', bundles: [],
});

beforeEach(() => {
  fetchScans.mockReset();
  fetchScans.mockImplementation(async (scope) => [scan(scope)]);
});

describe('usePrintSheetList', () => {
  it('탭마다 그 탭을 서버에서 걸러 읽는다', async () => {
    const hook = renderHook(({ scope }) => usePrintSheetList(scope), {
      initialProps: { scope: 'mine' as OwnerScope },
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(fetchScans).toHaveBeenLastCalledWith('mine', 'me');
    expect(hook.result.current.scans.map((s) => s.id)).toEqual(['mine']);

    hook.rerender({ scope: 'others' });
    // 옛 탭의 줄이 새 탭 이름 아래 보이면 안 된다
    expect(hook.result.current.loading).toBe(true);
    await waitFor(() => expect(hook.result.current.scans.map((s) => s.id)).toEqual(['others']));
  });

  it('누를 때 쥔 reload 도 지금 탭을 읽는다 — 새 탭이 읽는 중으로 멈추지 않는다', async () => {
    const hook = renderHook(({ scope }) => usePrintSheetList(scope), {
      initialProps: { scope: 'mine' as OwnerScope },
    });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    const staleReload = hook.result.current.reload;

    hook.rerender({ scope: 'others' });
    await act(async () => { await staleReload(); });

    expect(fetchScans).toHaveBeenLastCalledWith('others', 'me');
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.scans.map((s) => s.id)).toEqual(['others']);
  });
});
