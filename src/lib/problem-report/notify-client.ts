import { authFetch } from '@/lib/auth-fetch';

/**
 * 원장에게 웍스로 알리기 — 신고를 저장한 **뒤** 부른다(브라우저).
 * 알림이 실패해도 신고는 이미 남아 있다 — 결과는 안내 문구에만 쓴다.
 */

/** 알림 결과 — 닿음 / 못 닿음 */
export type ReportNotifyResult = 'reached' | 'failed';

/**
 * 알림 라우트를 부른다.
 * @param reportId - 방금 저장한 신고 id
 * @returns 원장에게 닿았으면(보냈거나 아침 브리핑 보관함에 넣음) 'reached'
 */
export async function notifyProblemReport(reportId: string): Promise<ReportNotifyResult> {
  try {
    const res = await authFetch('/api/notify-problem-report', {
      method: 'POST',
      body: JSON.stringify({ reportId }),
    });
    const body: unknown = await res.json().catch(() => null);
    const reached = res.ok && typeof body === 'object' && body !== null && (body as { reached?: unknown }).reached === true;
    return reached ? 'reached' : 'failed';
  } catch {
    return 'failed';
  }
}
