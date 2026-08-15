-- 개념지 저장 테이블
create table concept_sheets (
  id uuid primary key default gen_random_uuid(),
  title text not null default '제목 없음',
  -- 카테고리 정보 (BuilderCategory 필드)
  -- level 은 '중등' | '고등' | '외부지문 및 프린트'.
  -- 외부지문은 publisher/semester 대신 school_name/year 를 쓰고 unit 에 프린트/작품명이 들어간다.
  level text not null default '중등',
  year text not null default '',
  grade text not null default '',
  publisher text not null default '',
  semester text not null default '',
  unit text not null default '',
  subunit text not null default '',
  school_name text not null default '',
  -- 에디터 콘텐츠
  editor_html text not null default '',
  marks jsonb not null default '[]'::jsonb,
  -- 메타
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS 활성화
alter table concept_sheets enable row level security;

-- 도메인 제한 헬퍼(self-contained). 01_schema.sql / 08_migration_domain_restriction.sql
-- 의 정의와 동일하며 CREATE OR REPLACE 라 멱등하다 — 이 파일만 단독 재적용해도
-- 정책이 깨지지 않도록 함수를 먼저 보장한다.
create or replace function public.is_allowed_domain()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') like '%@araeducation.co.kr';
$$;
grant execute on function public.is_allowed_domain() to authenticated;

-- 모든 인증된 사용자 공유 (감사 로그로 변경 이력 추적)
create policy "Authenticated users can manage concept_sheets"
  on concept_sheets for all
  using (auth.role() = 'authenticated' and public.is_allowed_domain())
  with check (auth.role() = 'authenticated' and public.is_allowed_domain());

-- updated_at 자동 갱신 트리거
create or replace function update_concept_sheets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger concept_sheets_updated_at
  before update on concept_sheets
  for each row
  execute function update_concept_sheets_updated_at();
