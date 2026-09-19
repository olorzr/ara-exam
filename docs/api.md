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

### print_scans / print_bundles (학교 프린트 시험지, sql/26)
- SELECT/INSERT/UPDATE/DELETE: 공유(도메인 로그인 전원). `user_id` 는 트리거가 채운다
- `print_scans` 업로드한 스캔 PDF 1건 · `print_bundles` 그 안의 프린트 한 장(쪽 집합 + 학교/년도/학년/프린트명 + 손글씨 여부 + 상태)
- 시험지는 `concept_sheets.print_bundle_id` 로 이어지고 **묶음당 하나**다(부분 유니크 인덱스).
  묶음을 지우면 그 시험지도 CASCADE 로 함께 지워진다 — 확인창이 그 수를 반드시 밝힌다

### reference_texts (작품 전문, sql/30)
- SELECT/INSERT/UPDATE/DELETE: 공유(도메인 로그인 전원). `user_id` 와 `char_count` 는 **트리거가 채운다**
  — 앱이 보내는 값은 무시된다
- UPDATE 는 `.eq('updated_at', 불러올 때의 값)` 으로 **낙관적 동시성**을 건다(0행이면 남이 먼저 고친 것)
- 목록은 `REFERENCE_TEXT_LIST_COLUMNS`(본문 제외)로만 읽는다 — 전문 한 편이 수만 자다
- 검색은 칸마다 `ilike` 를 따로 돌려 합친다(`.or()` 금지 — 이스케이프가 인용을 통과하며 풀린다)

### 참고자료 조회 (문제 만들기 화면)
- 후보 찾기는 `concept_sheets`·`passages`·`reference_texts` 를 **신호마다 한 쿼리씩** 병렬로 돌린다.
  본문은 안 읽는다(개념지 본문은 `ilike('editor_html', …)` 로 서버에서만 훑는다)
- 붙인 자료의 본문만 id 로 따로 읽는다 — `concept_sheets(id, editor_html)` ·
  `fetchPassagesByIds` · `reference_texts(id, body)`

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
- 설명: AI 기능 활성 여부 조회. 화면이 AI UI 를 그릴지 판단하는 데 쓴다
- 인증: `Authorization: Bearer <supabase access_token>` (도메인 검사 포함)
- Response: `{ enabled: boolean, features: { problem_ocr: boolean, print_ocr: boolean, concept_pick: boolean, passage_quiz: boolean } }`
  - `problem_ocr` 기출 PDF 읽기 · `print_ocr` 학교 프린트 스캔 읽기 · `concept_pick` 개념지 빈칸 추천 ·
    `passage_quiz` 지문으로 O,X·단답형 만들기
  - 넷 다 같은 서버 env `AI_OCR_BETA` 를 본다. ⚠️ 기능을 추가하면 **다섯 곳을 함께** 고칠 것
    (`AiFeature` 타입 · `isFeatureEnabled` · 이 라우트의 OFF·응답 · `useAiEnabled` 의 타입과 OFF ·
    `ocrStillEnabled` 호출부). 하나라도 빠지면 그 키가 undefined 가 되어 '꺼짐'과 '아직 모름'이 섞인다
- 에러: 401 `{ ok: false, reason: 'unauthorized' }`
- 비고: **연결 상태·사용량은 여기서 다루지 않는다.** 그건 브라우저가 선생님 PC 의
  코덱스 브릿지에 직접 물어본다(서버는 AI 를 호출하지 않는다).

## POST /api/sync-to-grades
- 설명: 만들어진 단어 시험지를 ara-system(학원 관리 시스템) 성적에 **회차로 자동 등록**한다.
  서버가 `exams` + `exam_words` 스냅샷을 읽어 ara-system `/api/integrations/vocab-exam` 으로 전달한다
- 인증: `Authorization: Bearer <supabase access_token>` (도메인 검사 포함)
- Body: `{ examId: string }` (UUID)
- Response: `{ ok: true, result }` — 원본이면 result 에 `subtypeId`·`roundNumber`·`created`,
  **재시험이면 `{ retake: true, subtypeId: <원본 회차>, paperId, retakeNumber }`**
- 에러: 401 `unauthorized` · 400 `bad_body`/`bad_examId` · 404 `exam_not_found` ·
  500 `words_read_failed`/`category_read_failed`/`exception` · 502 `intake_failed`(+`status`·`detail`) ·
  **503 `not_configured`**(연동 env 미설정)
- ⚠️ **재시험은 회차를 만들지 않는다**(ara-system mig477). 원본 회차에 딸린 재시험지
  (`exam_retake_papers`)로 붙고, 학생별 차수는 채점할 때 오른다. 그래서 **원본이 아직 등록 전이면
  수신부가 409 `parent_not_registered`** 를 돌려주고 여기서는 502 `intake_failed`(status 409)로 올라간다.
  화면에는 '원본 시험지가 학원 성적에 아직 등록되지 않았어요' 토스트가 뜬다
- 비고: 호출은 시험 생성·재시험 직후 **fire-and-forget**(`keepalive`)이고 실패해도 생성 UX 를 막지
  않지만, 클라이언트가 응답을 읽어 **경고 토스트**를 띄운다([grade-sync-client.ts](../src/lib/grade-sync-client.ts)).
  ara-system 쪽이 멱등이라 재호출·재시험도 안전하다. 학교급은 시험 카테고리의 level/grade 로
  도출하며(단일 학교급일 때만) 미상이면 필드를 빼 ara-system 기본값(중등부)에 맡긴다

## POST /api/sync-concept-to-grades
- 설명: 저장된 개념지를 ara-system 성적에 **개념지당 1회차**로 자동 등록한다.
  개념 단어(`marks`)가 정답이자 문항 수다
- 인증: `Authorization: Bearer <supabase access_token>`
- Body: `{ conceptSheetId: string }` (UUID)
- Response: `{ ok: true, result }` — result 에 `subtypeId`·`roundNumber`·`created`
- 에러: 위와 같고, 추가로 200 `{ skipped: true, reason: 'no_marks' }`(마킹된 개념 단어 없음 — 정상)
- 비고: 폴더는 ara-system 이 만든다(`개념 시험 > 교과서 그룹 > 학년+학기`). 외부지문은 출판사가
  비어 있어 **publisher 슬롯에 학교명**을 보낸다 — 안 보내면 전부 '기타' 한 폴더에 뭉친다.
  ⚠️ 채점이 끝난 회차는 ara-system 이 분모·정답을 동결하므로 이름·날짜만 갱신된다
  (**합격 기준만은 갱신된다** — 잘못 넣은 기준을 고치면 지난 합격 판정도 함께 고쳐져야 한다)
- 합격 기준: 개념지의 `pass_percentage`(기본 80)와 그로 계산한 `passCount` 를 함께 보낸다.
  계산식(CEIL)은 [pass-count.ts](../src/lib/pass-count.ts) 단일 출처 — RPC·마이그레이션·백필과 미러

## RPC exam.set_source_textbook
- 설명: 기출 출처의 교과서를 바꾸고, 원하면 그 출처의 단원 태그를 **같은 트랜잭션에서** 지운다
- 인자: `p_source_id uuid`, `p_textbook text`, `p_clear_units boolean` (기본 true)
- Response: 저장된 교과서 이름(정규화됨)
- 에러: 출처를 못 찾으면 `no_data_found`
- 비고: 앱에서 UPDATE 세 번(문항·지문·출처)으로 나누면 중간 실패 때 태그만 사라진다.
  앱은 `p_clear_units` 를 **늘 true** 로 보낸다 — 미리 센 개수로 정하면 그 사이 다른 탭이
  붙인 태그가 새 교과서 아래 남는다(태그가 없으면 그 UPDATE 는 0행으로 지나간다)

## RPC exam.merge_passages
- 설명: 갈라져 저장된 지문 둘을 하나로. 본문·그림·**작품 목록** 이어 붙이기 + 딸린 문항 이관
  + 뒤 지문 삭제를 **한 트랜잭션**으로 한다
- 인자: `p_target uuid`(남는 앞 지문), `p_source uuid`(사라지는 뒤 지문)
- Response: 앞 지문의 새 `updated_at`
- 에러: 못 찾으면 `no_data_found`, 같은 지문끼리·다른 출처면 `invalid_parameter_value`
- 비고: 뒤 지문의 **그림 경로도 이어 붙이고** 그 본문의 `<figure data-figure="n">` 번호를
  앞 지문의 그림 수만큼 민다(sql/24) — 안 밀면 뒤 지문의 '1번' 이 앞 지문 그림을 가리킨다.
  두 지문의 그림이 상한(9)을 넘으면 **아무것도 건드리지 않고** `check_violation` 으로 멈춘다 —
  넘치는 그림만 버리고 성공했다고 알리면 지문이 지워진 뒤라 되돌릴 길이 없다.
  두 행을 `FOR UPDATE` 로 **잠그고** 읽는다(그 사이 남이 고친 본문을 덮어쓰지 않게).
  합친 뒤 `render_mode` 는 **글로 되돌린다** — 잘라 둔 이미지는 한쪽 쪽만 담고 있어
  이미지 출제로 두면 이어 붙인 부분이 인쇄물에서 사라진다.
  작품은 **빈 칸 채우기가 아니라 이어 붙이기**다(sql/33) — 쪽을 넘어가는 (가)(나) 지문이 둘로
  갈라지면 각자 한 편씩만 들고 있어서, 빈 칸만 채우면 뒤 편을 잃는다. 다만 **딸린 문항이 묻는
  작품은 늘지 않는다** — 쪽이 갈려 따로 읽힌 것뿐인데 앞 지문의 문항이 뒤 지문의 작품까지 묻게
  되면 없는 사실을 지어내는 셈이다 — 합치는 동안에는 전파 트리거를 트랜잭션 지역 표시
  (`exam.skip_work_sync`)로 끄고, 작품이 **아예 없던** 문항만 합쳐진 목록을 받는다.
  합친 작품이 상한(6편)을 넘으면 **아무것도 건드리지 않고** `check_violation` 으로 멈춘다
  (그림 상한과 같은 규약).
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
