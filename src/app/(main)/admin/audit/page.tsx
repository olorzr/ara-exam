'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { ADMIN_EMAIL } from '@/lib/constants';
import { formatDateKR } from '@/lib/format';
import type { AuditLog } from '@/types';
import { Shield, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const ACTION_LABEL: Record<string, string> = {
  INSERT: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
};

const ACTION_COLOR: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
};

const TABLE_LABEL: Record<string, string> = {
  exams: '시험지',
  concept_sheets: '개념지',
  words: '단어',
};

const PAGE_SIZE = 50;

/**
 * 관리자 전용 감사 로그 페이지. 누가 언제 무엇을 생성/수정/삭제했는지 확인한다.
 */
export default function AuditLogPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterTable, setFilterTable] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');

  useEffect(() => {
    if (!authLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    (async () => {
      if (authLoading || user?.email !== ADMIN_EMAIL) return;
      let query = supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (filterTable) query = query.eq('table_name', filterTable);
      if (filterAction) query = query.eq('action', filterAction);

      const { data, error } = await query;
      if (error) {
        setLoadError(true);
        toast.error('감사 로그를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        setLogs([]);
        setLoading(false);
        return;
      }
      setLoadError(false);
      setLogs(data ?? []);
      setLoading(false);
    })();
  }, [filterTable, filterAction, authLoading, user]);

  if (authLoading || !user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  /** 이메일에서 @ 앞 부분만 표시 */
  const shortEmail = (email: string | null) => {
    if (!email) return '알 수 없음';
    return email.split('@')[0];
  };

  /** 변경 데이터에서 제목 추출 */
  const extractTitle = (log: AuditLog): string => {
    const data = log.new_data ?? log.old_data;
    if (!data) return '-';
    if (log.table_name === 'words') {
      const word = data.word as string;
      const meaning = data.meaning as string;
      return word ? `${word} — ${meaning ?? ''}` : '-';
    }
    return (data.title as string) ?? '-';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-gray-900">감사 로그</h1>
      </div>

      {/* 필터 */}
      <div className="flex gap-3">
        <select
          value={filterTable}
          onChange={(e) => { setFilterTable(e.target.value); setLoading(true); }}
          className="border rounded-lg px-3 py-2 text-sm"
          aria-label="테이블 필터"
        >
          <option value="">전체 테이블</option>
          <option value="exams">시험지</option>
          <option value="concept_sheets">개념지</option>
          <option value="words">단어</option>
        </select>
        <select
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setLoading(true); }}
          className="border rounded-lg px-3 py-2 text-sm"
          aria-label="작업 필터"
        >
          <option value="">전체 작업</option>
          <option value="INSERT">생성</option>
          <option value="UPDATE">수정</option>
          <option value="DELETE">삭제</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : loadError ? (
        <p className="text-center text-red-500 py-20">감사 로그를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      ) : logs.length === 0 ? (
        <p className="text-center text-gray-400 py-20">감사 로그가 없습니다.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">시간</th>
                <th className="px-4 py-3 text-left font-medium">사용자</th>
                <th className="px-4 py-3 text-left font-medium">대상</th>
                <th className="px-4 py-3 text-left font-medium">작업</th>
                <th className="px-4 py-3 text-left font-medium">제목</th>
                <th className="px-4 py-3 text-left font-medium w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  expanded={expandedId === log.id}
                  onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  shortEmail={shortEmail}
                  extractTitle={extractTitle}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface LogRowProps {
  log: AuditLog;
  expanded: boolean;
  onToggle: () => void;
  shortEmail: (email: string | null) => string;
  extractTitle: (log: AuditLog) => string;
}

function LogRow({ log, expanded, onToggle, shortEmail, extractTitle }: LogRowProps) {
  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
          {formatDateKR(log.created_at)}
        </td>
        <td className="px-4 py-3 font-medium">{shortEmail(log.actor_email)}</td>
        <td className="px-4 py-3 text-gray-600">
          {TABLE_LABEL[log.table_name] ?? log.table_name}
        </td>
        <td className="px-4 py-3">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLOR[log.action] ?? ''}`}>
            {ACTION_LABEL[log.action] ?? log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-700 truncate max-w-xs">{extractTitle(log)}</td>
        <td className="px-4 py-3">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-gray-400" />
            : <ChevronRight className="h-4 w-4 text-gray-400" />
          }
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {log.old_data && (
                <div>
                  <p className="font-medium text-gray-500 mb-1">변경 전</p>
                  <pre className="bg-white border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(log.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {log.new_data && (
                <div>
                  <p className="font-medium text-gray-500 mb-1">변경 후</p>
                  <pre className="bg-white border rounded p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                    {JSON.stringify(log.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
