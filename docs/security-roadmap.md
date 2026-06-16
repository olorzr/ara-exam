# 보안·아키텍처 로드맵 (코덱스 전체 리뷰 후속)

[2026-06-17] 코덱스 전체 코드 리뷰에서 나온 항목 중, **아키텍처 변경·DB 스키마·인증 구조 개편**이 필요해
즉시 적용하지 않고 설계만 정리한 것들. 각 항목은 독립적으로 승인·진행 가능하다.

상태 범례: ⬜ 미착수 / 🟦 설계완료(이 문서) / ✅ 적용됨

---

## #4 세션을 localStorage → httpOnly 쿠키로 (`@supabase/ssr`) 🟦

### 문제
- 현재 `createClient()` 기본값이라 세션(액세스 토큰)이 브라우저 `localStorage` 에 저장된다
  ([src/lib/supabase.ts](../src/lib/supabase.ts)). XSS 가 한 번이라도 성공하면 토큰 탈취 → 세션 재사용이 가능하다.
- 인증 가드가 전부 클라이언트(`auth-context` 의 `useEffect` 리다이렉트, [(main)/layout.tsx](<../src/app/(main)/layout.tsx>))라
  서버에서 세션을 검증하지 못한다. 이 때문에 도메인 제한도 미들웨어가 아닌 RLS 로만 강제하고 있다(CLAUDE.md 결정).

### 설계
1. `@supabase/ssr` 도입(신규 의존성 — **사용자 승인 필요**). `@supabase/auth-helpers-nextjs`(deprecated, 현재 미사용에 가깝지만 deps 에 잔존)는 제거.
2. 브라우저/서버 클라이언트 분리:
   - `createBrowserClient()` (쿠키 기반)
   - `createServerClient()` (Route Handler·Server Component·middleware 용, `cookies()` 연동)
3. `middleware.ts` 신설: 모든 `(main)` 경로에서 세션·도메인을 서버에서 검증 → 미인증/비허용 도메인은 `/login` 리다이렉트.
   - **주의**: 현재 OAuth 콜백은 magic-link `token_hash` 를 `/auth/callback` 에서 교환한다([(auth)/auth/callback](<../src/app/(auth)/auth/callback/page.tsx>)).
     쿠키 세션 전환 시 이 교환을 서버 라우트에서 처리하도록 옮겨야 한다.
4. RLS 의 `is_allowed_domain()` 은 그대로 **권위 계층으로 유지**(미들웨어는 보조 UX/방어).

### 리스크 / 영향
- 인증 흐름 전면 개편 → **스테이징에서 로그인·세션 만료·재로그인 전체 회귀 테스트 필수**.
- 기존 로그인 사용자는 재로그인 1회 필요(저장소 변경).
- 규모: 大. 단독 PR 권장.

---

## #3 프로덕션 CSP 에서 `unsafe-inline` 제거 (nonce 기반) 🟦

### 문제
- [next.config.ts](../next.config.ts) 의 정적 `headers()` 가 `script-src 'self' 'unsafe-inline'` 을 부여한다.
  inline 스크립트/이벤트 핸들러 실행을 막지 못해, XSS 발생 시 CSP 의 완화 효과가 거의 없다.
- 현재 `unsafe-inline` 을 유지하는 이유: Next App Router 부트스트랩이 inline script 를 주입하기 때문(CLAUDE.md).

### 설계
1. 정적 `headers()` → `middleware.ts` 에서 **요청마다 nonce 생성**(`crypto.randomUUID()`/`crypto.getRandomValues`)하여
   `script-src 'self' 'nonce-<value>'` 로 동적 부여.
2. nonce 를 `next/script` 및 App Router 가 읽도록 전달(Next 14+ 의 nonce 전파 지원 활용).
3. 추가로 `require-trusted-types-for 'script'` 도입 검토(점진 적용).
4. `object-src 'none'`, `frame-ancestors 'none'`, `connect-src` 화이트리스트는 현행 유지.

### 리스크 / 영향
- **#4 의 `middleware.ts` 와 함께 진행하는 것이 효율적**(둘 다 미들웨어 필요).
- nonce 누락 시 정당한 스크립트가 차단되어 페이지가 깨질 수 있어 단계적 롤아웃(Report-Only CSP 먼저) 권장.
- 규모: 中. #4 와 묶으면 시너지.

---

## #6 객관식 선지/정답을 DB에 스냅샷 🟦

### 문제
- 객관식 선지·정답이 저장돼 있지 않고, 시험지/답안지가 **렌더 시점마다** `exam-choices.ts` 로 재계산된다
  ([MultipleChoiceView](../src/components/exam/MultipleChoiceView.tsx), [MultipleChoiceAnswerView](../src/components/exam/MultipleChoiceAnswerView.tsx)).
- PRNG·라벨·중복 제거 규칙(이번에 #7 로 변경됨)을 바꾸면 **과거 시험 이력의 객관식 정답이 소급 변경**된다.
  실제로 이번 #7 중복 제거 수정이 과거 시험의 선지 구성을 바꿨을 수 있다.

### 설계
1. 마이그레이션 `sql/14_*.sql`: `exam_words` 에 컬럼 추가
   - `choices JSONB`(라벨·표시문자열·정답여부 배열), `correct_label TEXT`, `choices_algorithm_version INT`.
   - 또는 별도 `exam_choices` 테이블(정규화). 스냅샷 성격상 `exam_words` 인라인이 단순하다.
2. `create_exam_with_words` (sql/10 + 01 미러)에서 신규 생성 시 선지를 **서버에서 1회 생성·저장**.
   - `exam-choices.ts` 의 로직을 SQL/plpgsql 로 포팅하거나, 생성 단계에서 클라이언트가 만들어 보낸 선지를 검증 후 저장.
   - 결정론 유지를 위해 최소한 **seed + algorithm_version** 만이라도 영속화하면, 렌더는 저장된 seed 로 재현 가능.
3. 뷰 컴포넌트는 저장된 `choices`/`correct_label` 이 있으면 그대로 사용, 없으면(레거시) 현행 재계산 fallback + `algorithm_version` 으로 분기.

### 리스크 / 영향
- 스키마 + RPC + 렌더 3계층 변경. 레거시 시험과의 호환(fallback) 설계가 핵심.
- "최소 버전"(seed+version만 저장)으로 시작하면 영향 범위를 크게 줄일 수 있다.
- 규모: 中~大.

---

## #11 (후속) 시험 이력/개념 목록 진짜 서버 페이지네이션 🟦

> 이번에 **과다 조회 축소**(시험 이력에서 무거운 `word_ids` 배열 제외)는 적용됨 ✅.
> 아래는 남은 **`range()` 기반 서버 페이지네이션** 설계.

### 문제
- 시험 이력은 여전히 원본+재시험 **전건**을 한 번에 로드해 클라이언트에서 필터·slice 한다
  ([useExamHistory.ts](../src/hooks/useExamHistory.ts)). 수년치가 쌓이면 초기 로드가 무거워진다.

### 설계 (주의: 스레드 그룹핑 + KST 날짜 필터 보존이 핵심)
1. **원본만** 서버 페이지네이션: `.is('parent_exam_id', null).order('created_at', desc).range(from, to)`.
2. 필터를 서버로 이동:
   - 제목 → `.ilike('title', '%q%')`
   - 카테고리 → `.overlaps('category_ids', ids)`
   - 날짜 → **로컬(KST) 날짜 문자열을 UTC 경계로 변환**해 `created_at` 범위 질의(0.1.3 의 off-by-one 수정 회귀 주의).
3. 로드된 페이지의 원본 id 들로 재시험 일괄 조회: `.in('parent_exam_id', pageIds)` → `retakeMap` 구성.
4. 개념 목록(이미 `editor_html` 제외)은 카드용 `range()` + **트리는 distinct 카테고리만 별도 경량 질의**로 분리.

### 리스크 / 영향
- 필터의 서버 이전이 미묘한 동작 변화를 유발할 수 있어(특히 KST 날짜), **실제 DB 대상 회귀 테스트 필요**.
- 규모: 中.
