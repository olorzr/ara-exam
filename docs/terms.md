# 도메인 용어 정의

## 카테고리 (Category)
- 정의: 단어를 분류하는 계층 구조 (중등/고등 > 학년 > 출판사 > 대단원 > 소단원)
- 코드에서의 사용: `Category` 타입, `categories` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 단어 (Word)
- 정의: 학생이 학습할 개별 어휘 항목 (단어 + 뜻)
- 코드에서의 사용: `Word` 타입, `words` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 시험지 (Exam)
- 정의: 카테고리에서 선택한 단어로 생성된 주관식 시험 문서
- 코드에서의 사용: `Exam` 타입, `exams` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 시험지 단어 (ExamWord)
- 정의: 시험지 생성 시점의 단어 스냅샷 (원본 수정과 무관하게 보존)
- 코드에서의 사용: `ExamWord` 타입, `exam_words` 테이블
- 관련 파일: `src/types/index.ts`, `sql/01_schema.sql`

## 합격선 (Pass Percentage)
- 정의: 시험 통과에 필요한 최소 정답률 (기본값 80%)
- 코드에서의 사용: `pass_percentage`, `pass_count`, `DEFAULT_PASS_PERCENTAGE`
- 관련 파일: `src/lib/constants.ts`, `src/app/(main)/exam/create/page.tsx`

## 외부지문 및 프린트 (External Level)
- 정의: 교과서 외 학교별 특이 지문/프린트물의 단어를 관리하는 별도 카테고리. 계층은 `학교 > 년도 > 학년 > 프린트/작품명`
- 코드에서의 사용: `EXTERNAL_LEVEL` 상수, `CategoryLevel` 타입, `buildExternalTree`
- 관련 파일: `src/lib/constants.ts`, `src/types/index.ts`, `src/lib/category-tree.ts`, `src/components/words/ExternalCategoryTab.tsx`

## 년도 / 학년 (외부지문의 year · grade)
- 정의: 프린트/작품명이 어느 **학년도**의 어느 **학년** 것인지. 같은 이름의 프린트를 해마다 따로 둘 수 있게 하는 구분자다. 중등/고등 교과 카테고리는 `year` 를 쓰지 않는다(학기가 그 역할)
- 코드에서의 사용: `school_materials.year/grade`, `categories.year/grade`, `concept_sheets.year/grade`. 값은 TEXT(`'2026'`, `'중2'`)이고 **빈 문자열 `''` 이 "미지정"** 이다. UI 표시값 `'미지정'` ↔ 저장값 `''` 변환은 `toStoredValue`/`toOptionValue` 한 곳에서만 한다
- 관련 파일: `src/lib/external-category.ts`, `src/lib/kst-year.ts`, `sql/15_migration_external_year_grade.sql`

## 미지정 (UNSPECIFIED_OPTION)
- 정의: 년도·학년이 정해지지 않은 상태. Select 에는 `'미지정'` 으로 보이고 DB 에는 `''` 로 저장된다. base-ui Select 가 빈 문자열 value 를 다루기 까다로워 센티널을 쓴다
- 코드에서의 사용: `UNSPECIFIED_OPTION`, `toStoredValue`, `toOptionValue`
- 관련 파일: `src/lib/external-category.ts`

## 카테고리 레벨 (CategoryLevel)
- 정의: 최상위 분류 ('중등' | '고등' | '외부지문 및 프린트')
- 코드에서의 사용: `CategoryLevel` 타입
- 관련 파일: `src/types/index.ts`

## 내신 시험범위 (Naesin Scope)
- 정의: ara-system 수업 > 내신 관리가 (학교×학년×학년도×학기×중간/기말) 단위로 저장한 시험범위·교과서·단원 체크·시험 기간. 이 앱은 읽기 전용으로 연동해 시험지 생성 시 해당 범위의 단어 카테고리를 자동 선택한다
- 코드에서의 사용: `ScopeSlotRow`, `fetchScopeSlot`, `matchScopeToCategories`, `publicDb()` (public 스키마 읽기 전용 — 쓰기 금지)
- 관련 파일: `src/lib/naesin-scope/`, `src/lib/supabase-public.ts`, `src/components/exam/NaesinScopeLoader.tsx`

## 기출 출처 (ProblemSource)
- 정의: 선생님이 올린 기출 PDF 한 건. 학교 내신·모의고사·문제집·프린트 네 종류
- 코드에서의 사용: `ProblemSource`, `problem_sources` 표, `source_type`
- 관련 파일: src/types/problem-bank.ts, src/lib/problem-bank/source-form.ts, sql/17_problem_bank.sql

## 지문 (Passage)
- 정의: 여러 문항이 함께 쓰는 글. "[1~3] 다음 글을 읽고 물음에 답하시오" 의 그 글
- 코드에서의 사용: `Passage`, `passages` 표, 문항의 `passage_id`
- 관련 파일: src/lib/problem-ocr/merge.ts, src/lib/problem-paper/blocks.ts

## 문항 (Problem)
- 정의: 발문·선지·정답을 가진 문제 하나. 단어 시험지의 '문항'과는 다른 개념이다.
  배점 컬럼(`score`)은 남아 있지만 2026-09-08 부터 읽지도 보여 주지도 않는다
- 코드에서의 사용: `Problem`, `problems` 표
- 관련 파일: src/types/problem-bank.ts, src/components/problem-review/ProblemEditorCard.tsx

## 문제지 (ProblemPaper)
- 정의: 아카이브 문항을 골라 조합한 인쇄물. 본문은 만든 시점의 **스냅샷**이라 원본이 바뀌어도 변하지 않는다
- 코드에서의 사용: `ProblemPaper`, `problem_papers` / `problem_paper_items`, RPC `create_problem_paper`
- 관련 파일: src/lib/problem-paper/compose.ts, sql/17_problem_bank.sql

## 교과서 (textbook)
- 정의: 그 기출이 다루는 교과서. 값은 카테고리 관리의 **출판사 이름 스냅샷**(`exam.publishers.name`)이다
- 코드에서의 사용: `ProblemSource.textbook`, `fetchUnitTree`, 아카이브 필터 `book`
- 관련 파일: src/lib/problem-bank/unit-master.ts, src/components/problem-ocr/SourceTextbookField.tsx

## 단원 경로 (unit_path)
- 정의: 문항·지문이 실린 교과서 단원을 **이름 배열**로 스냅샷한 값 (`['1. 문학', '(1) 시의 화자']`, 최대 2단).
  마스터는 카테고리 관리(대단원·소단원)이고 여기서는 고르기만 한다 — area_path 와 같은 규약
- 코드에서의 사용: `Problem.unit_path`, `buildUnitTree`, `UNIT_DEPTH_LABELS`
- 관련 파일: src/lib/problem-bank/unit-tree.ts, src/lib/problem-bank/unit-master.ts, sql/18_problem_bank_units.sql

## 문법 분류 (grammar_paths)
- 정의: 문항이 묻는 문법 개념을 **이름 경로 문자열의 목록**으로 스냅샷한 값
  (`['단어 > 품사 > 명사', '문장 > 문법 요소 > 피동 표현']`, 문항당 최대 5개).
  체계는 수능 문법 교재 목차(6개 대분류 / 100개 핵심 개념)이고 마스터는 **코드 상수**다
- ⚠️ area_path·unit_path 와 **모양이 다르다**: 그쪽은 배열 하나가 경로 하나라 문항에 한 개만
  붙지만, 문법은 한 문항이 개념 두셋을 걸쳐서 경로를 `' > '` 로 이어 붙인 문자열을 원소로 담는다.
  그래서 상위 검색이 `contains`(@>)가 아니라 **`overlaps`(&&)** 다 — 고른 가지의 잎을 전부 펴서 찾는다
- 깊이는 가지마다 다르다(담화·어문 규정은 2단, 나머지는 3단). DB 제약은 경로 길이가 아니라 **개수**다
- 코드에서의 사용: `Problem.grammar_paths`, `GRAMMAR_TREE`, `GRAMMAR_ALL_PATHS`, `grammarPathsUnder`,
  `expandGrammarAncestors`, `isGrammarArea`, RPC `add_grammar_paths`, 아카이브 필터 `gram`
- 훑어보는 화면은 [문법 트리](#문법-트리-grammar-browse-tree), 개수는 [문법 개념 건수](#문법-개념-건수-grammarfacet) 참고
- 관련 파일: src/lib/problem-bank/grammar-tree.ts, src/components/problem-review/GrammarTagPicker.tsx,
  sql/21_problem_bank_grammar.sql

## 구역 상자 (data-box)
- 정의: 지문·발문 안의 상자·구간 표시. 값의 종류에 따라 인쇄 모양이 셋이다 —
  `보기`·`자료`·`조건`(+번호)은 〈보기〉 테두리 상자, `가`~`마`는 (가) 머리글, `A`~`E`는 [A] 왼쪽 세로선.
  괄호는 인쇄 CSS 가 붙이므로 값에는 넣지 않는다
- 코드에서의 사용: `isBoxLabel`, `normalizeBoxAttributes`, `BOX_LABEL_OPTIONS`
- 관련 파일: src/lib/box-labels.ts, src/lib/sanitize-problem.ts, src/styles/problem-paper.css

## 학교급 (SchoolLevel)
- 정의: 중등 / 고등. 업로드 폼에서 학교·학년 선택지를 좁히는 데만 쓰고 **저장하지 않는다** —
  DB 에서는 학년('중2') 접두사로 되찾는다
- 코드에서의 사용: `SCHOOL_LEVEL_OPTIONS`, `gradeOptionsForLevel`, `levelFromGrade`
- 관련 파일: src/lib/problem-bank/source-form.ts

## 영역 경로 (area_path)
- 정의: 문항의 분류를 **이름 배열**로 스냅샷한 값 (`['문학','현대시']`). 마스터는 ara-system 이 소유하고 여기서는 고르기만 한다
- 코드에서의 사용: `Problem.area_path`, `isKnownPath`, `longestKnownPrefix`
- 관련 파일: src/lib/problem-bank/area-tree.ts, src/lib/problem-bank/area-master.ts

## 이미지로 출제 (render_mode: 'image')
- 정의: 표·그림이 많아 글로 옮기지 못한 문항·지문을 **잘라 둔 원본 이미지**로 인쇄하는 방식
- 코드에서의 사용: `render_mode`, `image_path`
- 관련 파일: src/lib/problem-ocr/crop.ts, src/components/problem-paper/PaperPrintBlocks.tsx

## 코덱스 브릿지 (Codex bridge)
- 정의: 선생님 PC 에서 도는 작은 중계 프로그램. 브라우저가 자기 ChatGPT 로 OCR 을 돌리게 해 준다. 학원 서버는 AI 를 호출하지 않는다
- 코드에서의 사용: `src/lib/ai/codex/*`, `ws://127.0.0.1:8899`
- 설치: 윈도우는 파일 3개 다운로드(`install-autostart.cmd` 더블클릭), 맥은 터미널 한 줄
  (`install-mac.sh` → codex 설치 + ChatGPT 로그인 + LaunchAgent `kr.co.araeducation.ara-ai`).
  둘 다 ara-system 이 호스팅한다. 맥의 codex 는 `~/.ara-ai/npm` 에 깔려 셸 PATH 에는 없다
- ⚠️ **Safari 로는 붙지 못한다** — WebKit 이 https 문서의 `ws://127.0.0.1` 을 mixed content 로
  막는다. 맥 선생님은 Chrome 을 써야 한다
- 관련 파일: src/lib/ai/codex/README.md, Ara-system `public/ara-ai/bridge.cjs`

## 답지 (answer_key_paths)
- 정의: 시험지와 **따로** 받은 정답표 파일. 별지 PDF 하나 또는 사진 여러 장이다. 같은 PDF 안에 정답표가 붙어 있는 경우는 답지가 아니라 **정답표 쪽**(업로드에서 역할로 지정, `ocr_meta.pages`)이다
- 코드에서의 사용: `ProblemSource.answer_key_paths`(Storage 경로 배열), `AnswerKeyInput`, `sourceAnswerKeyPath(sourceId, index, ext)`
- 관련 파일: src/lib/problem-ocr/answer-key-input.ts, src/lib/problem-ocr/answer-key-upload.ts, src/lib/problem-ocr/run-answer-key.ts, sql/19_problem_bank_answer_key.sql

## 학교 기출 트리 (school exam tree)
- 정의: 아카이브 왼쪽에서 **학교 › 학년도 › 학년 › 학기·시험** 으로 훑는 폴더. `source_type='내신기출'` 출처만 나오고, 마스터가 아니라 실제로 읽어 둔 출처(패싯)로 만든다
- 코드에서의 사용: `SchoolExamFacet`, `buildSchoolExamTree`, `SourceFacets.schoolExams`
- 관련 파일: src/lib/problem-bank/school-exam-tree.ts, src/components/problem-bank/SchoolExamTreePanel.tsx, src/components/problem-bank/ArchiveSidePanel.tsx

## 문법 트리 (grammar browse tree)
- 정의: 아카이브 왼쪽에서 **대분류 › 중분류 › 개념** 으로 훑는 폴더. 다른 세 트리와 달리
  **마스터(`GRAMMAR_TREE`) 전체**를 그리고 개념마다 문항 수를 얹는다 — 아직 한 문항도 없는
  개념도 흐리게(`dimmed`) 보이고, 고를 수는 있다
- ⚠️ 마스터로 만드는 까닭: 문법 태그는 업로드가 아니라 **나중에 손으로** 붙는 것이라,
  패싯(태깅된 잎)만 쓰면 '태그 0건 → 선택지 0건 → 붙일 길 없음' 이라는 닭-달걀이 된다
- 가지도 고를 수 있어야 해서(= '품사 전체') 가지마다 **`(전체)` 잎**을 단다.
  교과서 단원 트리가 이미 쓰는 방식이라 `FacetTree` 의 클릭 규약은 그대로 둔다
- 코드에서의 사용: `buildGrammarBrowseTree`, `grammarFilterPatch`, `grammarNodeKey`,
  `grammarSelectOptions`, `GRAMMAR_SELF_LEAF`, `GRAMMAR_ALL_PATHS`
- 관련 파일: src/lib/problem-bank/grammar-browse-tree.ts, src/components/problem-bank/GrammarTreePanel.tsx, src/components/problem-bank/ArchiveSidePanel.tsx

## 문법 개념 건수 (GrammarFacet)
- 정의: 문법 경로마다 붙는 **문항 수**. 트리 라벨의 `(5)` 가 이것이다
- ⚠️ **조상은 잎의 합이 아니다.** 한 문항이 같은 조상 아래 태그를 둘 달 수 있어(피동+사동)
  그냥 더하면 한 문항을 두 번 센다. 문항마다 걸리는 경로를 집합으로 모아 **경로당 한 번만** 센다 —
  그래야 상위 검색(잎들의 `overlaps`)의 결과 수와 맞는다
- 다른 필터를 반영하지 않는 **전역값**이다(작품 패싯과 같은 규약). `FACET_MAX_ROWS` 를 넘으면 근사치가 된다
- 코드에서의 사용: `GrammarFacet`, `fetchGrammarFacets`, `tallyGrammarCounts`, `useProblemArchive().grammarCounts`
- 관련 파일: src/lib/problem-bank/grammar-counts.ts, src/lib/problem-bank/facets.ts

## 선택지 (SelectOption)
- 정의: 고르는 칸의 **값과 보여 줄 이름 한 쌍**(`{ value: '__all__', label: '유형 전체' }`)
- ⚠️ base-ui 의 `Select.Value` 는 `Select.Root` 에 `items`(값→이름 지도)가 없으면 고른 **값을
  그대로** 그린다. `SelectItem` 의 children 은 팝업 안에서만 쓰이고, `SelectItem` 의 `label` 은
  타이프어헤드용이라 대신해 주지 않는다. 그래서 아카이브 필터가 `__all__` 로 보였다
- `OptionSelect` 는 `items` 와 `SelectItem` 을 **같은 배열**에서 만들어 어긋날 수 없게 하고,
  원시 `Select` 는 `items` 를 **타입으로 강제**한다
- 코드에서의 사용: `SelectOption`, `OptionSelect`, `toSelectOptions`
- 관련 파일: src/components/ui/option-select.tsx, src/components/ui/select.tsx, src/lib/problem-bank/filter-axes.ts

## 미지정만 (UNSPECIFIED_AXIS)
- 정의: 아카이브 필터에서 **저장값이 비어 있는 행만** 고르는 값(`'__none__'`). 필터의 빈 문자열은 '전체'(조건 없음)라서, '미지정인 것만'은 따로 표시해야 한다
- 코드에서의 사용: `UNSPECIFIED_AXIS`, `toProblemQuery`(센티널만 `''` 조건으로 바꾼다), `queries.ts`(조건 유무를 `!== undefined` 로 가른다)
- 관련 파일: src/lib/problem-bank/filters.ts, src/lib/problem-bank/queries.ts, src/lib/problem-bank/school-exam-tree.ts, src/components/problem-bank/ProblemFilterBar.tsx
