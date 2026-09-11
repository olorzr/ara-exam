# API 엔드포인트

이 프로젝트는 별도의 API 라우트 없이 Supabase 클라이언트를 직접 사용합니다.
모든 데이터 접근은 RLS(Row Level Security) 정책으로 보호됩니다.

## Supabase 테이블 CRUD

### categories
- SELECT: 로그인 사용자의 카테고리 목록 조회
- INSERT: 새 카테고리 생성 (단어 입력 시 함께 생성)
- DELETE: 카테고리 삭제 (CASCADE로 하위 단어도 삭제)

### words
- SELECT: 특정 카테고리의 단어 목록 조회
- INSERT: 새 단어 등록 (개별 또는 CSV 대량)
- UPDATE: 단어/뜻 수정
- DELETE: 개별 단어 삭제

### exams
- SELECT: 시험지 목록 및 상세 조회
- INSERT: 새 시험지 생성
- DELETE: 시험지 삭제

### exam_words
- SELECT: 시험지에 포함된 단어 스냅샷 조회
- INSERT: 시험지 생성 시 단어 스냅샷 저장

## 인증
- 방식: Supabase Auth (이메일/비밀번호)
- signInWithPassword: 로그인
- signUp: 회원가입
- signOut: 로그아웃

## GET /api/ai/status
- 설명: AI 기능(기출 OCR) 활성 여부 조회. 화면이 AI UI 를 그릴지 판단하는 데 쓴다
- 인증: `Authorization: Bearer <supabase access_token>` (도메인 검사 포함)
- Response: `{ enabled: boolean, features: { problem_ocr: boolean } }`
- 에러: 401 `{ ok: false, reason: 'unauthorized' }`
- 비고: **연결 상태·사용량은 여기서 다루지 않는다.** 그건 브라우저가 선생님 PC 의
  코덱스 브릿지에 직접 물어본다(서버는 AI 를 호출하지 않는다).

## RPC exam.set_source_textbook
- 설명: 기출 출처의 교과서를 바꾸고, 원하면 그 출처의 단원 태그를 **같은 트랜잭션에서** 지운다
- 인자: `p_source_id uuid`, `p_textbook text`, `p_clear_units boolean` (기본 true)
- Response: 저장된 교과서 이름(정규화됨)
- 에러: 출처를 못 찾으면 `no_data_found`
- 비고: 앱에서 UPDATE 세 번(문항·지문·출처)으로 나누면 중간 실패 때 태그만 사라진다.
  앱은 `p_clear_units` 를 **늘 true** 로 보낸다 — 미리 센 개수로 정하면 그 사이 다른 탭이
  붙인 태그가 새 교과서 아래 남는다(태그가 없으면 그 UPDATE 는 0행으로 지나간다)

## RPC exam.merge_passages
- 설명: 갈라져 저장된 지문 둘을 하나로. 본문 이어 붙이기 + 딸린 문항 이관 + 빈 칸 채우기
  + 뒤 지문 삭제를 **한 트랜잭션**으로 한다
- 인자: `p_target uuid`(남는 앞 지문), `p_source uuid`(사라지는 뒤 지문)
- Response: 앞 지문의 새 `updated_at`
- 에러: 못 찾으면 `no_data_found`, 같은 지문끼리·다른 출처면 `invalid_parameter_value`
- 비고: 두 행을 `FOR UPDATE` 로 **잠그고** 읽는다(그 사이 남이 고친 본문을 덮어쓰지 않게).
  합친 뒤 `render_mode` 는 **글로 되돌린다** — 잘라 둔 이미지는 한쪽 쪽만 담고 있어
  이미지 출제로 두면 이어 붙인 부분이 인쇄물에서 사라진다.
  나눠 보내면 '본문은 합쳐졌는데 문항은 옛 지문에 남은' 상태가 되어 인쇄에서 같은
  지문이 두 번 나온다

## RPC exam.create_problem_paper
- 설명: 문제지 생성. `problem_papers` 의 **유일한 쓰기 경로**다(직접 INSERT 는 RLS 로 막혀 있다)
- 인자: `p_title text`, `p_problem_ids uuid[]`, `p_settings jsonb`
- Response: 만들어진 문제지 `uuid`
- 검증: 도메인 · 제목 비지 않음 · 1~200개 · 중복 없음 · 전부 실재 ·
  **같은 지문의 문항이 붙어 있을 것**(흩어지면 인쇄에서 지문이 여러 번 나온다)
- 비고: 본문을 `problem_paper_items.snapshot` 에 굳힌다. 설정은 화이트리스트로 재조립한다.
  지문 스냅샷에 `figure_paths` 가 있다(sql/23) — 안 실으면 아카이브 화면은 멀쩡한데
  **인쇄물에서만** 그림이 사라진다. sql/23 이전 문제지에는 이 키가 없으므로 앱이 `?? []` 로 받는다
