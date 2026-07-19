import { createClient } from '@supabase/supabase-js';
import type { ExamSchemaClient } from './supabase';

let _client: ExamSchemaClient | null = null;

/**
 * 서버 사이드 전용 Supabase Admin 클라이언트.
 * Service Role Key를 사용하여 RLS를 우회하고 사용자 관리 작업을 수행한다.
 * 빌드 시 환경변수 부재로 인한 에러를 방지하기 위해 lazy initialization을 사용한다.
 */
export const supabaseAdmin: ExamSchemaClient = new Proxy({} as ExamSchemaClient, {
  get(_target, prop) {
    if (!_client) {
      // db.schema: 공유 Supabase 프로젝트의 전용 `exam` 스키마 (supabase.ts 와 동일한 이유)
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { db: { schema: 'exam' }, auth: { autoRefreshToken: false, persistSession: false } },
      );
    }
    return Reflect.get(_client, prop);
  },
});
