# Project Rules

## File Structure
- 파일당 300줄 이하 유지. 초과 시 반드시 분리
- 하나의 파일은 하나의 역할만 담당 (Single Responsibility)
- 폴더 구조: feature 기반 (예: /features/auth/, /features/dashboard/)

## Naming
- 컴포넌트: PascalCase (UserCard.tsx)
- 유틸/훅: camelCase (useAuth.ts, formatDate.ts)
- 상수: UPPER_SNAKE_CASE
- 타입/인터페이스: PascalCase + 접미사 (UserProps, ApiResponse)

## Code Quality
- 함수는 한 가지 일만 수행
- 매직 넘버 금지 → 상수로 추출
- 중복 코드 발견 시 즉시 추출
- early return 패턴 사용 (중첩 if 금지)
- 모든 export 함수에 JSDoc 주석

## When Editing
- 수정 전 관련 파일을 먼저 읽고 구조 파악
- 300줄 초과하면 리팩터링 먼저 제안
- 새 파일 생성 시 index.ts에서 re-export

## Error Handling
- try-catch는 최상위에서만
- 에러 메시지는 사용자 친화적으로
- 콘솔 로그 대신 전용 logger 사용

## Testing
- 새 함수 작성 시 테스트 파일도 함께 생성
- 테스트 파일명: *.test.ts

## Dependencies
- 새 패키지 설치 전 반드시 사용자에게 확인
- 기존 라이브러리로 해결 가능한지 먼저 검토
- package.json에 없는 패키지를 임의로 추가하지 말 것

## Git & Commits
- Conventional Commits 형식: feat:, fix:, refactor:, docs:, test:, chore:
- 커밋 메시지는 한글 OK, 본문에 변경 이유 포함
- 하나의 커밋 = 하나의 논리적 변경

## Type Safety
- any 사용 금지 → unknown + 타입 가드 사용
- API 응답은 반드시 타입/인터페이스 정의
- as 타입 단언 최소화, 런타임 검증 우선

## Performance
- 불필요한 리렌더 방지 (React.memo, useMemo 적절히 사용)
- N+1 쿼리 금지
- 대량 데이터는 페이지네이션 또는 가상 스크롤 적용

## Security
- 시크릿/키는 반드시 환경변수(.env)로 관리
- 사용자 입력은 항상 검증 및 sanitize
- SQL/NoSQL 인젝션 방지 (parameterized query 사용)
- .env 파일은 절대 커밋하지 말 것

## Accessibility
- 시맨틱 HTML 사용 (div 남용 금지)
- 인터랙티브 요소에 aria 속성 포함
- 키보드 내비게이션 지원
- 색상만으로 정보를 전달하지 말 것

## Workflow
- 작업 전: 관련 파일 구조 파악 → 계획 제시 → 승인 후 코드 작성
- 작업 후: 변경된 파일 목록과 요약 제공
- 확신 없는 결정은 먼저 물어볼 것, 임의로 진행하지 말 것

---

## Documentation & Knowledge Management

### CLAUDE.md (이 파일) 유지 규칙
- 작업 중 발견한 중요한 사항, 주의점, 버그 패턴은 이 파일에 즉시 기록
- "다음에 이 코드를 수정할 때 꼭 알아야 할 것"이 있으면 반드시 추가
- 프로젝트 아키텍처 결정 사항(왜 이 방식을 선택했는지)도 기록
- 기록 시 날짜 포함 (예: [2025-03-09] Supabase RLS 정책 때문에 직접 쿼리 불가)

### docs/terms.md 관리
- 프로젝트에서 사용하는 도메인 용어, 비즈니스 용어를 정의
- 새로운 개념이나 용어가 등장하면 즉시 terms.md에 추가
- 형식:
```
  ## 용어명 (영문명)
  - 정의: ...
  - 코드에서의 사용: 변수명/타입명 등
  - 관련 파일: ...
```
- 코드에서 사용하는 변수명/타입명과 terms.md의 용어를 일치시킬 것
- 용어가 모호하면 사용자에게 확인 후 기록

### docs/architecture.md 관리
- 프로젝트 전체 구조도 유지 (모듈 간 의존관계)
- 주요 데이터 흐름 설명
- 새 모듈 추가 시 이 문서도 함께 업데이트
- 형식:
```
  ## 모듈명
  - 역할: ...
  - 의존: ...
  - 주요 파일: ...
```

### docs/env.example 관리
- 필요한 환경변수 목록과 설명을 예시 파일로 유지
- 새 환경변수 추가 시 반드시 이 파일도 업데이트
- 형식:
```
  # 데이터베이스
  DATABASE_URL=postgresql://user:password@localhost:5432/dbname
  
  # 인증
  JWT_SECRET=your-secret-key-here
```

### docs/api.md 관리
- API 엔드포인트 목록과 요청/응답 형식 기록
- 엔드포인트 변경 시 반드시 업데이트
- 형식:
```
  ## POST /api/auth/login
  - 설명: 로그인
  - Body: { email: string, password: string }
  - Response: { token: string, user: User }
  - 에러: 401 (잘못된 인증정보), 429 (요청 제한)
```

### CHANGELOG.md 관리
- 프로젝트 루트에 유지
- 버전별 주요 변경사항 기록
- 형식:
```
  ## [0.2.0] - 2025-03-09
  ### Added
  - 소셜 로그인 (Google, Kakao)
  ### Fixed
  - 토큰 만료 시 무한 리다이렉트 버그
  ### Changed
  - API 응답 형식 통일
```

### 문서 업데이트 원칙
- 코드 변경 시 관련 문서도 반드시 함께 업데이트
- 문서가 코드와 불일치하면 즉시 수정
- 모든 문서는 한글로 작성

---

## Known Issues
- [2026-03-09] Tailwind CSS v4에서 `print\:hidden` 같은 이스케이프 pseudo-class가 CSS 파싱 에러를 발생시킴 → `data-no-print` 어트리뷰트 + 순수 CSS로 대체
- [2026-03-09] shadcn Select의 `onValueChange`가 `string | null`을 전달함 → `(v) => { if (v) setter(v); }` 패턴 필요
- [2026-04-16] `concept_sheets.editor_html` 은 `authenticated` 전원에게 쓰기가 허용된 공유 테이블이라 한 계정이 오염시키면 다른 사용자 세션이 탈취될 수 있다. Stored XSS 방지를 위해 `sanitizeConceptHTML` ([src/lib/sanitize-html.ts](src/lib/sanitize-html.ts)) 를 저장 경로(`handleSave` in [src/hooks/useConceptSheetEditor.ts](src/hooks/useConceptSheetEditor.ts)) 와 렌더 변환 경로([src/lib/exam-transform.ts](src/lib/exam-transform.ts) 의 `transformHTML` / `stripTrailingEmpty` / `extractMarkedWords` 세 함수 entry) 양쪽에서 반드시 호출해야 한다. 새 TipTap 확장을 추가할 때는 `sanitize-html.ts` 의 `ALLOWED_TAGS` / `ALLOWED_ATTR` 화이트리스트를 같이 갱신하지 않으면 새 마크업이 조용히 제거된다
- [2026-06-16] 위 sanitize 는 **읽기(편집기 로드) 경로에서도** 호출해야 한다. 저장 시 정화했더라도 과거 오염 데이터·직접 DB/RPC 쓰기가 남을 수 있으므로, `useConceptSheetEditor` 의 기존 개념지 로드에서 `sheet.editor_html` 을 `sanitizeConceptHTML` 로 정화한 뒤 `initialHTML`/`editorHTML` 에 넣는다(편집기 `content` 주입 전 차단). 또한 `sanitize-html.ts` 는 **`class` 속성을 허용하지 않고**(Tailwind 유틸리티로 `fixed inset-0` 전체화면 overlay 주입 차단 — TipTap getHTML 은 이 확장 셋에서 class 를 직렬화하지 않으므로 정당 마크업 영향 없음), `ALLOW_DATA_ATTR: false` 로 두어 명시 화이트리스트(`data-concept`/`data-bg-color`/`data-border*`/`data-colwidth`)만 통과시킨다. 새 확장이 새 class/data-* 를 직렬화하면 화이트리스트를 같이 갱신해야 조용히 사라지지 않는다
- [2026-05-26] `sanitize-html.ts` 의 `style` 속성은 통째로 허용하면 안 된다. DOMPurify 는 CSS 속성값(예: `position:fixed;inset:0` 전체화면 overlay, `background-image:url(...)`)을 막지 않으므로, `uponSanitizeAttribute` 훅이 CSS 속성 화이트리스트(`text-align`, `background-color`, `border-*-color`)만 안전한 값으로 통과시키고 나머지는 제거한다. TipTap 이 만드는 정당한 inline style 은 이 셋뿐(TextAlign + CustomTableCell). 새 서식 확장이 inline style 을 쓰면 `ALLOWED_CSS_PROPS` 와 값 검증(`TEXT_ALIGN_VALUES` / `COLOR_VALUE_REGEXP`)을 같이 갱신해야 조용히 사라지지 않는다

## Architecture Decisions
- [2026-03-09] 포인트 컬러 `#81D8D0`을 CSS 변수 `--primary`로 통합 → Tailwind `text-primary`, `bg-primary` 등으로 일관되게 사용
- [2026-03-09] 카테고리 포맷팅/그룹화 로직을 `lib/format.ts`로 추출 → words, exam/create 등 여러 페이지에서 중복 제거
- [2026-03-09] words/new 페이지를 CategoryForm + WordEntryTable로 분리 → 300줄 제한 준수
- [2026-03-09] App Router route 그룹 `(auth)`, `(main)`으로 인증 필요/불필요 영역 분리
- [2026-03-09] 네이버 웍스(LINE WORKS) OAuth 로그인으로 전환 → email/password 인증 제거, `@araeducation.co.kr` 도메인만 허용, Supabase admin API + magic link로 세션 수립

- [2026-03-10] 카테고리 마스터 테이블 도입 (publishers, major_chapters, sub_chapters, schools, school_materials) → 모든 사용자 공유, RLS는 authenticated만 체크. 기존 categories 테이블은 단어 그룹 매핑용으로 유지 (텍스트 값 저장)
- [2026-03-10] 외부지문 트리 구조: 학교명 > 프린트/작품명 (2레벨), 중등/고등: 출판사 > 학기 > 대단원 > 소단원 (4레벨)
- [2026-03-10] CategoryTree 컴포넌트를 단어 관리/시험지 생성에서 공유 → 단일 선택(onSelect) / 다중 선택(onToggle+multiSelect) 모드 지원

- [2026-04-16] concept_sheets Stored XSS 대응으로 `isomorphic-dompurify` 기반 화이트리스트 sanitize 를 다층 방어 (저장 경로 + exam-transform 세 함수 entry) 로 적용. CSP 는 [next.config.ts](next.config.ts) 의 정적 `headers()` 로 부여 — prod 에서도 Next App Router 부트스트랩 inline script 때문에 `script-src 'unsafe-inline'` 은 유지하되 `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트(`*.supabase.co`, NaverWorks) 로 유출 경로를 차단. DOMPurify 가 1차 방어, CSP 가 safety net 역할. RLS 는 학원 협업 모델을 위해 `authenticated` 공유를 유지. 향후 개선 후보: (1) `editor_html` → JSONB (TipTap `getJSON`), (2) nonce 기반 CSP, (3) concept_sheets 쓰기를 서버 라우트로 이전해 감사/rate limit 적용

- [2026-06-16] 카테고리 단일 출처화(방향 A). 단어지(`words`/`exams`)는 `categories` 를 **id 로 참조**해 마스터 이름 변경이 자동 반영되지만, 개념지(`concept_sheets`)는 같은 `categories` 트리에서 고르되 텍스트(`publisher`/`unit`/`subunit`)를 **복사 저장**해 rename 이 반영되지 않는 비대칭이 있었다. 완전 정규화(concept_sheets→categories FK) 대신, 위험이 낮은 **rename 트리거 동기화 확장**을 선택 — `sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name` 가 categories 와 함께 concept_sheets 도 갱신한다([sql/07_migration_sync_concept_sheets.sql](sql/07_migration_sync_concept_sheets.sql)). 향후 무결성이 더 필요하면 FK 정규화(B)로 승격 가능

- [2026-06-16] SQL 파일을 **적용 순서대로 번호(01~12) 접두사**를 붙여 정리했다(`sql/01_schema.sql` … `sql/12_fix_audit_log_insert_policy.sql`). 번호가 곧 신규 부트스트랩 적용 순서이며, 의존성 기반으로 결정됨(테이블 생성 → 감사/공유 → 도메인 RLS → categories 유니크 → exam_words 잠금 → 감사 함수 패치). 과거/대체된 마이그레이션(`00_apply_2026-05-26_security`, `migration_retake*`, `migration_enforce_user_id`, `migration_exam_rpc`)은 `sql/archive/` 로 이동해 이력만 보존(정의가 포인터 주석으로 무력화돼 신규 적용 대상 아님). 새 마이그레이션을 추가할 땐 다음 번호를 붙이고, 다른 SQL 파일을 참조하는 주석/문서 링크는 번호 포함 경로로 쓸 것
- [2026-06-16] **(위 항목 정정) `migration_enforce_user_id` 는 archive 에 두면 안 되는 *실행 대상* 트리거였다** — user_id(NOT NULL) 를 채우는 유일 경로라 archive 에만 있으면 신규 환경 생성이 전부 깨진다. 그래서 `sql/13_migration_enforce_user_id.sql` 로 승격했고 **신규 부트스트랩 범위는 01~13** 이다(`sql/archive/migration_enforce_user_id.sql` 은 SUPERSEDED 헤더로 무력화). 13 은 `CREATE OR REPLACE` + `DROP TRIGGER IF EXISTS` 라 멱등 — 기존 운영 DB(이미 트리거 보유)에 재적용해도 안전. archive 의 나머지(`00_apply...`, `migration_retake*`, `migration_exam_rpc`)는 여전히 포인터 무력화된 신규 적용 비대상

## Gotchas
- [2026-03-09] `@supabase/auth-helpers-nextjs`는 deprecated됨. 현재 직접 `@supabase/supabase-js` 사용 중
- [2026-03-09] exam_words 테이블은 단어 스냅샷이므로 원본 단어를 수정해도 기존 시험지에는 영향 없음
- [2026-04-14] `audit_log` 에는 INSERT 정책을 만들지 말 것. SECURITY DEFINER 트리거(postgres 소유, BYPASSRLS)가 RLS 를 우회하여 쓰기를 수행하므로 정책은 불필요하며, 어떤 열린 INSERT 정책이든 authenticated 클라이언트에게 직접 쓰기를 허용해 감사 로그 오염 경로가 된다 (과거 `"System can insert audit_log"` 정책 사례 참고)
- [2026-04-15] SECURITY DEFINER 함수는 반드시 `SET search_path = public, pg_temp` 를 지정할 것. 지정하지 않으면 호출 세션의 search_path 조작으로 함수 본문의 무자격 객체 참조(`audit_log` 등)가 엉뚱한 스키마로 해석되어 감사 로그 우회/오염이 가능해진다. `pg_temp` 는 반드시 마지막에 두어 임시 객체 섀도잉을 차단한다 (감사 트리거 함수 9개 참고 — [sql/11_fix_audit_functions_search_path.sql](sql/11_fix_audit_functions_search_path.sql))
- [2026-04-15] `exams` / `categories` / `concept_sheets` 의 `user_id` 는 BEFORE INSERT 트리거 `enforce_user_id_from_auth` 가 `auth.uid()` 로 강제 채우고, BEFORE UPDATE 트리거 `lock_user_id_on_update` 가 변경을 무효화한다. 클라이언트에서 `user_id` 를 보내지 말 것 — 보내도 무시되며, 이전엔 클라이언트가 임의 UUID 로 생성자 위조가 가능했다. RLS 는 여전히 `authenticated` 만 체크하는 공유 정책이므로 attribution 은 감사/필터용 메타로만 의미를 가진다. RPC `create_exam_with_words` 시그니처에서도 `p_user_id` 가 제거됨. `ensureCategoryId` 는 더 이상 `userId` 를 받지 않으며 매칭에서도 제외해 학원 내 동일 단원이 사용자별로 중복 생성되지 않는다. **[2026-06-16 정정] 이 두 트리거의 정식 정의는 [sql/13_migration_enforce_user_id.sql](sql/13_migration_enforce_user_id.sql) 다** — 그동안 정의가 `sql/archive/migration_enforce_user_id.sql` 에만 있어 번호 마이그레이션(01~12)만 적용한 신규 환경에서는 트리거가 없어 `user_id`(NOT NULL) 가 채워지지 않아 모든 생성이 깨지고 보안 전제도 빠지는 문제가 있었다. 신규 부트스트랩 범위는 이제 01~13 이다(13 은 멱등이라 기존 운영 DB 에 재적용해도 안전)
- [2026-04-15] 재시험 차수(`exams.retake_number`) 는 클라이언트에서 계산하지 말 것 — 두 사용자가 동시에 누르면 같은 `(parent_exam_id, retake_number)` 가 만들어진다. `create_exam_with_words` RPC 가 `p_parent_exam_id IS NOT NULL` 일 때 `pg_advisory_xact_lock(hashtext(parent::text))` 으로 직렬화 후 `MAX(retake_number)+1` 을 계산하고, 제목 접미사 `(재시험 N차)` 도 서버가 `format()` 으로 조립한다. 따라서 재시험 호출에서는 (a) `p_title` 에 **원본 제목만** 넘기고, (b) `p_retake_number` 를 보내지 말고, (c) 토스트/UI 는 RPC 반환 후 새 행을 다시 조회해 서버 차수를 사용해야 한다. 최후 안전망으로 `idx_exams_parent_retake_unique` (`(parent_exam_id, retake_number) WHERE parent_exam_id IS NOT NULL`) 부분 유일 인덱스가 RPC 우회 INSERT 까지 차단한다 — [sql/archive/migration_retake_atomic.sql](sql/archive/migration_retake_atomic.sql) 참조
- [2026-04-22] 객관식 시험 선지 셔플에 glibc LCG `(s * 1103515245 + 12345) & 0x7fffffff` 를 직접 쓰지 말 것. 하위 비트 랜덤성이 나빠 `% 5` 같은 작은 modulo 에서 정답이 4·5번으로만 쏠렸다(실측 16/20, 4/20). 추가로 시드를 UUID char code 합으로 계산하면 값 범위가 2300~2900 에 몰려 편향이 증폭된다. `src/lib/exam-choices.ts` 의 **mulberry32 + FNV-1a** 조합을 사용할 것 — 1000회×20문항 시뮬레이션에서 각 위치 ~20% 균등. [MultipleChoiceView.tsx](src/components/exam/MultipleChoiceView.tsx), [MultipleChoiceAnswerView.tsx](src/components/exam/MultipleChoiceAnswerView.tsx) 는 반드시 이 공유 모듈의 `generateChoices` / `getCorrectLabel` 을 써야 시험지와 답안지 매핑이 일치한다 — 셔플 로직을 한쪽만 바꾸면 답지가 틀어진다
- [2026-05-26] 배열 셔플에 `arr.sort(() => Math.random() - 0.5)` 를 쓰지 말 것 — 비교 함수가 비일관적이라 permutation 분포가 치우친다. 문제 순서 셔플(비결정)에는 [src/lib/shuffle.ts](src/lib/shuffle.ts) 의 `shuffle` (Fisher-Yates) 를, 시험지/답안지가 동일해야 하는 결정론적 셔플에는 `exam-choices.ts` 의 `seededShuffle` 를 쓴다
- [2026-05-26] `exam_words` 는 더 이상 클라이언트가 직접 INSERT/UPDATE/DELETE 할 수 없다. RLS 를 SELECT 전용으로 잠갔고(이전엔 `FOR ALL` 공유라 누구나 남의 시험지 단어를 변조/삭제 가능했고 감사도 없었다), 유일한 쓰기 경로인 `create_exam_with_words` 는 **SECURITY DEFINER** 로 바꿔 잠긴 RLS 를 우회해 INSERT 한다(`auth.uid()` 는 DEFINER 에서도 요청 JWT 를 읽어 attribution 유지). **DEFINER 라 테이블 RLS(도메인 조건)를 우회하므로 함수 첫머리에서 `public.is_allowed_domain()` 을 직접 검사**한다. RPC 는 `total_questions`/`pass_count`/`word_ids` 를 서버에서 재계산하고, **신규 생성**(`p_parent_exam_id IS NULL`)은 word·meaning 을 canonical `words` 에서 재조립 + 전 word_id 실재 검증해 내용 위조를 막는다. [2026-06-17] **`category_ids` 도 클라이언트 입력(`p_category_ids`)을 버리고 실제 포함 단어들의 `words.category_id`(NOT NULL) DISTINCT 집합으로 서버 재계산**해 출처/필터 라벨 위조를 차단한다(01_schema.sql 미러 + sql/10 둘 다 갱신 — 재적용 필요). **재시험**(`p_parent_exam_id IS NOT NULL`)은 클라이언트 입력(p_words/p_category_ids/메타)을 전혀 신뢰하지 않고 **서버가 부모 exam·exam_words 를 직접 읽어 재조립**(서버 셔플 순서)한다 — 직접 RPC 호출로 가짜 "재시험 N차" 를 만드는 것을 차단. 부모 스냅샷 복사라 삭제된 단어도 보존된다. RPC 클라이언트 호출 계약(원본 제목만, p_retake_number 미전달)은 그대로 — [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql). DEFINER 가 RLS 를 우회하려면 함수 owner 가 테이블 owner/BYPASSRLS 여야 하므로 반드시 postgres 로 적용할 것
- [2026-05-26] `create_exam_with_words` 의 정식 정의는 [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql) **한 곳**에서만 관리한다(+ 01_schema.sql 미러). 과거 `archive/migration_enforce_user_id.sql` / `archive/migration_retake_atomic.sql` / `archive/migration_exam_rpc.sql` 이 각자 함수를 재정의하고 `03_shared_exams_audit_log.sql` 이 `exam_words FOR ALL` 정책을 재생성해, 실행 순서에 따라 advisory lock·DEFINER·검증·쓰기잠금·도메인조건이 사라지는 퇴행이 있었다(전부 정의/정책을 제거하고 포인터 주석으로 대체함). 정책 소유권: 01_schema.sql(기준) + 10_migration_lock_exam_words.sql(exam_words SELECT 전용) + 08_migration_domain_restriction.sql(도메인). SQL 적용 순서: [2026-06-16] **파일명 번호(01~12) 순서대로 적용한다** — 번호가 곧 적용 순서다. `10_migration_lock_exam_words.sql` 이 마지막(exam_words 잠금·canonical RPC·도메인 가드 최종 승자)이고 `11`/`12` 는 감사 함수 패치다. `sql/archive/` 의 파일들(`00_apply...`, `migration_retake*`, `migration_enforce_user_id`, `migration_exam_rpc`)은 과거/대체된 마이그레이션으로 **신규 적용 대상이 아니다**(정의가 포인터 주석으로 무력화됨, 이력 보존용). 클라이언트 코드보다 `09_migration_categories_unique.sql`(upsert onConflict 의존)·`08_migration_domain_restriction.sql` 을 먼저 적용할 것. `01_schema.sql` 은 도메인 조건·categories 유니크 인덱스·is_allowed_domain 까지 포함한 **핵심 테이블(words/exams/exam_words/categories + 마스터)** 의 완전한 기준 상태다. 단, [2026-06-16 수정] `concept_sheets` 와 `audit_log` 테이블 DDL 은 01_schema.sql 에 없으므로(각각 [sql/02_create_concept_sheets.sql](sql/02_create_concept_sheets.sql), [sql/03_shared_exams_audit_log.sql](sql/03_shared_exams_audit_log.sql) 에만 존재) **01_schema.sql 단독으로는 신규 환경을 완전히 부트스트랩하지 못한다**. 신규 부트스트랩은 `sql/` 의 **번호 순서(01→12)대로 전부 적용**한다(05_words_audit·06_words_concurrency·07_migration_sync_concept_sheets·11·12 포함). 01_schema.sql 의 rename-sync 트리거가 `concept_sheets` 를 UPDATE 하지만, plpgsql 본문은 런타임에만 검증되므로 테이블이 나중에 생성돼도 트리거 생성 자체는 실패하지 않는다
- [2026-05-26] 도메인 제한(@araeducation.co.kr)은 RLS 헬퍼 `public.is_allowed_domain()` 으로 데이터 계층에서 강제한다([sql/08_migration_domain_restriction.sql](sql/08_migration_domain_restriction.sql)). 세션이 localStorage 에 저장되어(@supabase/ssr 미사용) 서버 미들웨어로 세션을 못 읽기 때문. 모든 공유 테이블 정책의 USING/WITH CHECK 에 `AND public.is_allowed_domain()` 가 붙어 있으니 새 테이블/정책 추가 시 함께 넣을 것. 클라이언트 가드(auth-context)와 OAuth 콜백 검사는 보조(UX)이며 권위는 RLS 다. 도메인 문자열은 [src/lib/constants.ts](src/lib/constants.ts) 의 `ALLOWED_EMAIL_DOMAIN` / `isAllowedEmailDomain` 로 통일
- [2026-05-26] `categories` 는 자연키(`level, grade, publisher, semester, chapter, sub_chapter, school_name`)에 유니크 인덱스 `idx_categories_natural_key`(NULLS NOT DISTINCT)가 있다. `ensureCategoryId` 는 SELECT→INSERT 대신 `upsert({ onConflict: ... })` 단일 호출로 동시 저장 중복을 막는다 — onConflict 컬럼 목록(`CATEGORY_NATURAL_KEY`)은 인덱스와 정확히 일치해야 한다. 인덱스 없이 코드만 배포하면 upsert 가 실패하므로 [sql/09_migration_categories_unique.sql](sql/09_migration_categories_unique.sql) 를 먼저 적용할 것
- [2026-06-16] 마스터 이름 rename 동기화 트리거(`sync_publisher_name`/`sync_major_chapter_name`/`sync_sub_chapter_name`)는 `categories` 와 `concept_sheets` 를 **둘 다** 갱신해야 한다. concept_sheets 는 컬럼명이 다르다: categories `chapter`↔concept_sheets `unit`, `sub_chapter`↔`subunit`(publisher/level/grade/semester 는 동일). 한쪽만 갱신하면 단어지와 개념지에 같은 출판사가 두 표기로 갈라진다. concept_sheets 는 자연키 유니크 제약이 없어 같은 표기로 수렴해도 에러 없이 행이 합쳐져 보인다(categories 는 유니크 인덱스가 있어 두 출판사를 같은 이름으로 통일하면 충돌 가능 — 그쪽은 [sql/09_migration_categories_unique.sql](sql/09_migration_categories_unique.sql) 의 병합으로 처리). 외부지문(schools/school_materials) 트리거는 concept_sheets 대상 아님(중등/고등만). 정식 정의는 01_schema.sql + [sql/07_migration_sync_concept_sheets.sql](sql/07_migration_sync_concept_sheets.sql) 미러
- [2026-06-21] `exams` 도 직접 INSERT/UPDATE 를 막았다(이전엔 `FOR ALL` 공유라 누구나 `create_exam_with_words` RPC 를 우회해 `supabase.from('exams').insert(...)` 로 exam_words 와 매칭 안 되는 가짜 시험지·메타데이터 위조 INSERT, 또는 남의 시험지 제목/합격선/차수를 UPDATE 변조할 수 있었다 — 감사 트리거는 남지만 변조 자체는 못 막았다). 정책을 **SELECT/DELETE 전용**으로 바꾸고, 생성은 오직 SECURITY DEFINER `create_exam_with_words` 로만 한다(DEFINER owner=postgres 라 RLS 우회 INSERT, INSERT 정책 불필요). 삭제는 클라이언트 직접 + `audit_exam_delete` 감사 유지, 수정(UPDATE)은 앱 경로가 없어 기본 deny(향후 편집 기능은 전용 DEFINER RPC 로 추가). 정식 정의: [sql/14_migration_lock_exams_writes.sql](sql/14_migration_lock_exams_writes.sql) + 01_schema.sql·08_migration_domain_restriction.sql 미러(셋 다 SELECT/DELETE — 한 곳만 바꾸면 적용 순서상 `FOR ALL` 부활 위험). **신규 부트스트랩 범위는 이제 01~14**. exam_words 잠금(sql/10)과 같은 결의 구멍이었다. 클라이언트는 exams 를 SELECT/DELETE + RPC 로만 쓰므로 기존 앱과 호환(직접 INSERT/UPDATE 코드 없음)
- [2026-06-21] `create_exam_with_words` **신규 생성** 분기에 검증 3종 추가 — (1) **중복 word_id 차단**(`cardinality(v_word_ids) <> DISTINCT count`; exam_words 에 `(exam_id, word_id)` 유니크 제약이 없어 직접 RPC 호출로 같은 단어를 5번 넣으면 객관식 선지가 5개 미만으로 무너졌다), (2) **표시 문자열 distinct ≥ 5**(`COUNT(DISTINCT words.word)`; [exam-choices.ts](src/lib/exam-choices.ts) 가 `word` 문자열로 선지 중복을 제거하므로 서로 다른 word_id 라도 표기가 같으면 선지 부족), (3) **order_index 서버 canonicalize** — 클라이언트 `order_index` 를 버리고 `jsonb_array_elements(p_words) WITH ORDINALITY` 의 배열 위치(`ord-1`)를 `v_word_ids` 정렬과 `exam_words.order_index` 양쪽에 쓴다(음수/중복/희소 order_index 로 출제 순서를 망가뜨리는 우회 차단). [sql/10_migration_lock_exam_words.sql](sql/10_migration_lock_exam_words.sql) + 01_schema.sql 미러 — **재적용 필요**
- [2026-06-21] OAuth redirect_uri·콜백 리다이렉트 origin 을 Host 헤더가 아니라 환경변수 **`APP_ORIGIN`** 으로 고정한다([src/lib/app-origin.ts](src/lib/app-origin.ts) 의 `resolveAppOrigin`). Host 조작으로 redirect_uri 가 오염되거나 매직링크 `token_hash` 가 공격자 호스트로 새는 것을 막는다. **프로덕션 fail-closed**: `APP_ORIGIN` 미설정/오설정(스킴 누락 등)이면 throw → 두 OAuth 라우트(`naver-works/route.ts`, `callback/route.ts`)가 제어된 500 반환(내부 설정명 비노출, try/catch 로 감쌈). 따라서 **배포 환경에 `APP_ORIGIN` 을 반드시 설정**해야 로그인이 동작한다(로컬은 미설정 시 요청 origin 폴백). [docs/env.example](docs/env.example) 참고
- [2026-06-21] CSP `style-src`/`font-src` 에 `https://cdn.jsdelivr.net` 을 허용한다([next.config.ts](next.config.ts)). [globals.css](src/app/globals.css) 가 Pretendard/GmarketSans 폰트 스타일시트를 jsdelivr 에서 `@import` 하고 그 시트가 같은 CDN 의 woff2 를 불러오는데, `'self'` 만 두면 프로덕션에서 폰트가 차단된다. 폰트 import 호스트를 바꾸면 CSP 도 같이 갱신할 것
- [2026-06-21] `concept_sheets` 저장은 공유 테이블이라 last-write-wins 였다 → `useConceptSheetEditor` 가 로드 시 `updated_at` 을 기억하고 저장 시 `.eq('updated_at', loadedUpdatedAt)` 로 **낙관적 동시성 제어**한다(0행 갱신=충돌이면 새로고침 안내). 저장 성공 시 반환된 `updated_at` 으로 버전을 갱신해 연속 저장이 가능하다. `updated_at` 은 `concept_sheets_updated_at` 트리거가 자동 갱신([sql/02_create_concept_sheets.sql](sql/02_create_concept_sheets.sql))