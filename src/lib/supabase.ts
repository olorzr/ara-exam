import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * exam 스키마를 기본으로 쓰는 클라이언트 타입 (db.schema 옵션이 타입 파라미터에 반영됨).
 * 이 레포는 생성된 Database 타입이 없어 기본 SupabaseClient 와 동일하게 any 기반이다
 * (기존 bare SupabaseClient 도 암묵적 any) — 스키마 파라미터만 'exam' 으로 고정한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExamSchemaClient = SupabaseClient<any, any, 'exam', any, any>;

let _client: ExamSchemaClient | null = null;

/**
 * Supabase 클라이언트 인스턴스.
 * 빌드 시 프리렌더링 환경에서 환경변수 부재 에러를 방지하기 위해 lazy initialization을 사용한다.
 */
export const supabase: ExamSchemaClient = new Proxy({} as ExamSchemaClient, {
  get(_target, prop) {
    if (!_client) {
      // db.schema: ara-system 과 Supabase 프로젝트를 공유하며 이 앱의 테이블은 전용
      // `exam` 스키마에 산다. 이 옵션 하나로 모든 from()/rpc() 가 exam 스키마를 향한다.
      // (auth 는 스키마 옵션과 무관하게 항상 프로젝트 공용 auth 를 쓴다)
      _client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { db: { schema: 'exam' } },
      );
    }
    return Reflect.get(_client, prop);
  },
});
