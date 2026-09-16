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
- 정의: 시험 통과에 필요한 최소 정답률 (기본값 80%). **미만이면 재시험** — 학원의 모든 시험에 적용된다
- 어디에 있나: 단어 시험지 `exams.pass_percentage`, **개념지 `concept_sheets.pass_percentage`**(sql/25)
- 코드에서의 사용: `pass_percentage`, `pass_count`, `DEFAULT_PASS_PERCENTAGE`, `passCountOf`
- 관련 파일: `src/lib/constants.ts`, `src/lib/pass-count.ts`, `src/app/(main)/exam/create/page.tsx`,
  `src/components/exam-builder/PassPercentageField.tsx`
- ⚠️ 합격 개수 계산식(CEIL)은 **네 곳이 1:1 미러**다: `create_exam_with_words` RPC ·
  `pass-count.ts` · ara-system migration 477 · ara-system `scripts/backfill-araexam-grades.js`

## 재시험 (Retake)
- 정의: 합격선 미만인 학생이 한 번 더 보는 시험. 단어시험은 **같은 단어를 다시 섞은 시험지**를
  새로 만들고(시험 기록 화면의 '재시험' 버튼), 개념시험은 **같은 개념지를 합격할 때까지** 다시 본다
- 코드에서의 사용: `exams.parent_exam_id` + `retake_number`(이 앱의 시험지), `handleRetest`
- 관련 파일: `src/hooks/useExamHistory.ts`, `src/components/exam/ExamHistoryCard.tsx`,
  `sql/10_migration_lock_exam_words.sql`(차수·셔플·제목 접미사를 서버가 결정)
- ⚠️ **학원 관리 시스템에서는 재시험이 회차가 아니다**(그쪽 mig477) — 재시험지는 원본 회차에 붙고
  (`exam_retake_papers`), 학생별 차수는 `exam_results.attempt_no` 로 표현된다. 원본이 미등록이면
  동기화가 409 로 거절한다

## 외부지문 및 프린트 (External Level)
- 정의: 교과서 외 학교별 특이 지문/프린트물의 단어를 관리하는 별도 카테고리. 계층은 `학교 > 년도 > 학년 > 프린트/작품명`
- 코드에서의 사용: `EXTERNAL_LEVEL` 상수, `CategoryLevel` 타입, `buildExternalTree`
- 관련 파일: `src/lib/constants.ts`, `src/types/index.ts`, `src/lib/category-tree.ts`, `src/components/words/CategoryForm.tsx`
- ⚠️ **카테고리 관리(`/categories`)에 외부지문 탭은 없다**(2026-09-14). 학교는 관리자시스템이 원본이고, 프린트는 `학교 프린트 시험지` 업로드가 `ensureSchoolMaterial` 로 자동 등록한다 — 앱에 프린트 이름을 고치거나 지우는 화면은 없다(이름 변경 전파는 DB 트리거 `exam.sync_school_material_name` 뿐)

## 년도 / 학년 (외부지문의 year · grade)
- 정의: 프린트/작품명이 어느 **학년도**의 어느 **학년** 것인지. 같은 이름의 프린트를 해마다 따로 둘 수 있게 하는 구분자다. 중등/고등 교과 카테고리는 `year` 를 쓰지 않는다(학기가 그 역할)
- 코드에서의 사용: `school_materials.year/grade`, `categories.year/grade`, `concept_sheets.year/grade`. 값은 TEXT(`'2026'`, `'중2'`)이고 **빈 문자열 `''` 이 "미지정"** 이다. UI 표시값 `'미지정'` ↔ 저장값 `''` 변환은 `toStoredValue`/`toOptionValue` 한 곳에서만 한다
- 관련 파일: `src/lib/external-category.ts`, `src/lib/kst-year.ts`, `sql/15_migration_external_year_grade.sql`

## 학교 프린트 시험지 (print sheet)
- 정의: 아이들이 학교에서 받아 온 **프린트를 스캔해 만든 개념지**. 시험지 자체는 `concept_sheets` 행이고 `print_bundle_id` 가 채워져 있다는 점만 다르다 — 편집·빈칸 변환·인쇄·합격 기준·성적 연동이 전부 개념지와 같다
- ⚠️ **개념지 목록(`/exam/builder`)에는 보이지 않는다.** `print_bundle_id IS NULL` 인 행만 그 목록에 나오고, 프린트 시험지는 `/print-sheets` 에서만 보인다(한 학기에 수십 장이라 섞이면 개념지가 묻힌다)
- ⚠️ '프린트' 라는 말이 이 저장소에 **셋** 있다: ① 카테고리 레벨 `외부지문 및 프린트`(단어·개념지의 학교별 분류), ② 기출 출처 유형 `프린트`(기출 문제 은행), ③ 이 기능. 이 기능은 ①의 카테고리를 **그대로 쓴다**(학교 > 년도 > 학년 > 프린트명)
- 묶음마다 **단어 등록**을 켤 수 있다 — 아래 '프린트 단어 등록' 참조
- 코드에서의 사용: `concept_sheets.print_bundle_id`, `createSheetForBundle`, `bundleSheetCategory`
- 관련 파일: `src/lib/print-scan/save.ts`, `src/lib/print-scan/bundle-plan.ts`, `src/app/(main)/print-sheets/`, `sql/26_print_scans.sql`

## 프린트 단어 등록 (register_words · words_meta)
- 정의: 학교 프린트에 **'단어 — 뜻' 으로 인쇄된 어휘**를 그 프린트의 카테고리(학교 > 년도 > 학년 > 프린트명)에 단어로 등록하는 기능. 묶음마다 켜고 끄며 기본은 꺼짐(`print_bundles.register_words`)
- ⚠️ **뜻이 적힌 단어만 등록한다.** 뜻이 없는 단어는 AI 가 사전 뜻을 지어내지 않고 이름만 경고로 알린다 — 지어내면 학생이 외울 답이 선생님이 나눠 준 프린트와 달라진다
- ⚠️ 단어가 들어갈 카테고리는 시험지와 **같은 자연키**여야 한다: `bundleWordsCategory` 가 `bundleSheetCategory` 를 변환해 만든다(따로 적으면 언젠가 한쪽만 고쳐져 시험지와 단어가 다른 폴더로 갈라진다)
- 등록 영수증은 `print_bundles.words_meta`. ⚠️ `ocr_meta` 와 **따로 둔다** — '다시 읽기' 가 `ocr_meta` 를 통째로 덮어쓰는데 단어 등록은 목록 버튼으로 따로 돌 수 있어 수명이 다르다
- ⚠️ 영수증 안에서도 **누적값과 마지막 시도를 가른다**: `wordCount`(올려 둔 단어 수, 줄지 않음)가 칩·단어 관리 링크·삭제 안내의 단일 출처(`registeredWordCount`)이고, `status`/`registered`/`skipped`/`noMeaning`/`unverified` 는 **마지막 시도**의 결과다. 다시 등록하면 전부 중복이라 `registered` 가 0 이고, 다시 등록하다 실패하면 그 시도의 숫자가 전부 0 인데 단어는 DB 에 그대로 있다
- ⚠️ **뜻도 본문과 대조한다.** 단어만 본문에 있으면 모델이 사전 풀이를 붙여 와도 통과하므로, 공백을 접은 본문에 그 뜻이 글자 그대로 있어야 등록한다(아니면 `unverified` 로 돌려주고 알린다)
- 읽기가 끝난 뒤 자동으로 돌고, 목록의 **'단어 등록'** 버튼으로 나중에 따로 돌릴 수도 있다(업로드 때 안 켠 프린트·옛 프린트를 되살리는 유일한 길). 다시 등록해도 `ON CONFLICT DO NOTHING` 이라 멱등이다
- 기능 플래그는 `print_ocr` 을 **재사용한다**(새 `AiFeature` 는 다섯 곳을 함께 고쳐야 한다)
- 코드에서의 사용: `registerBundleWords`, `runPrintWords`, `parsePrintWords`, `wordsChip`, `usePrintWordsRegister`
- 관련 파일: `src/lib/print-words/`, `src/hooks/usePrintWordsRegister.ts`, `sql/28_print_bundle_words.sql`

## 스캔 정보 (ScanMeta)
- 정의: 스캔 한 건이 공통으로 지니는 값 — **학교급 → 학교 → 학년 → 학년도 → 학기 → 중간·기말**. PDF 를 고르는 자리에서 **한 번만** 묻고, 저장할 때 그 스캔의 묶음마다 복사한다
- 묻는 차례가 곧 좁혀 가는 차례다(기출 업로드의 `SourceMetaForm` 과 같은 규약): 학교급을 골라야 학교 목록(중등 15 / 고등 5)과 학년(중1~3 / 고1~3)을 그 급으로 좁힌다. 학교급을 바꾸면 **학교·학년을 비운다**(학년도·학기·시험은 급과 무관해 남긴다)
- ⚠️ **학교급은 저장하지 않는다** — 선택지를 좁히는 데만 쓰고 `grade`('중2')의 접두사로 되찾는다(`levelFromGrade`). 아래 '학교급' 항목과 같은 규약
- ⚠️ 값은 **표시값**이다('미지정' 이 섞일 수 있다). `''` 로 바꾸는 일은 저장 직전 `toBundleInsert` 에서 `toStoredValue` 로 한 번만 한다
- ⚠️ DB 는 여전히 **묶음 단위**다(`print_bundles.school_id`·`year`·`grade`·`semester`·`exam_type`). 읽는 쪽(카테고리 트리·rename 트리거·목록 줄)이 전부 묶음 행을 보기 때문이다 — 스캔 표에 두면 그 모두가 조인을 하나 더 타야 한다
- 제목은 학교를 고르면 `2026 상현중 중2 1학기 중간` 으로 **자동으로 채워지고**, 직접 치면 멈추고, 비우면 다시 따라간다(`titleAuto` — 기출 폼의 `suggestTitle` 과 같은 규약). 학교를 고르기 전에는 **빈 제목**이다(학교 없는 `2026` 이 이름으로 박히면 그대로 남는다)
- 코드에서의 사용: `ScanMetaValues`, `ScanMetaState`, `applyScanMetaPatch`, `suggestScanTitle`, `schoolsForLevel`, `validateScanMeta`, `ScanMetaForm`
- 관련 파일: `src/lib/print-scan/scan-meta.ts`, `src/components/print-scan/ScanMetaForm.tsx`, `sql/29_print_bundle_exam_meta.sql`

## 프린트 이름 규칙 (composePrintName)
- 정의: 저장되는 프린트 이름은 **스캔 제목 + 프린트별 이름**이다 — `2026 상현중 중2 1학기 중간` + `봄봄 학습지`. 합치는 자리는 `composePrintName` **한 곳**이고 `normalizeCategoryName` 을 거친다
- 프린트별 이름은 **비워도 된다**(프린트가 한 장뿐인 스캔). 그때는 스캔 제목이 곧 프린트 이름이다
- ⚠️ 한 스캔 안에서 합친 이름이 **겹치면 막는다**(`validateBundles`). 겹치면 `school_materials` 의 `UNIQUE(name, school_id, year, grade)` 에 막혀 두 프린트가 카테고리 트리에서 한 자리를 쓰고 시험지 제목까지 같아진다
- 이 이름 하나가 `print_bundles.name` → `concept_sheets.unit`(= 시험지 제목이자 카테고리) → `school_materials.name`(트리 잎) → 단어 카테고리 `chapter` 로 그대로 흐른다. 그래서 **시험지 제목도 이 이름 그대로**다(`generateConceptTitle` 을 쓰면 학교·년도가 두 번 나온다)
- 코드에서의 사용: `composePrintName`, `validateBundles`, `toBundleInsert`, `createSheetForBundle`
- 관련 파일: `src/lib/print-scan/scan-meta.ts`, `src/lib/print-scan/bundle-plan.ts`, `src/lib/print-scan/save.ts`

## 프린트 스캔 (PrintScan)
- 정의: 선생님이 올린 **스캔 PDF 한 건**. 한 파일에 여러 아이의 여러 프린트가 섞여 있는 것이 보통이라 묶음으로 나눠 읽는다
- 원본 PDF 를 Storage 에 남긴다 — **'다시 읽기' 가 이 파일에 달려 있다**(파일 없이 다시 읽을 방법이 없다)
- 코드에서의 사용: `PrintScan`, `printScanPdfPath(scanId)`, `print-scans/{id}/original.pdf`
- 관련 파일: `src/types/print-scan.ts`, `src/lib/print-scan/storage-paths.ts`, `src/lib/print-scan/run-scan.ts`

## 프린트 묶음 (PrintBundle)
- 정의: 스캔 안의 **프린트 한 장** = 시험지 한 장. 원본 쪽 집합(`pages`) + 분류(학교·년도·학년·학기·시험) + 프린트명 + 손글씨·단어 등록 여부를 들고 있다. OCR 은 묶음 단위로 돈다
- 분류는 **스캔에서 복사된다**(위 '스캔 정보' 참조) — 화면은 스캔마다 한 번만 묻는다. 학기·시험은 `sql/29` 로 생겼고 `''` 가 미지정이다
- ⚠️ 그 `semester` 를 `bundleSheetCategory` 에 **넣지 않는다** — 외부지문 계층은 `학교 > 년도 > 학년 > 프린트` 라 학기가 자연키에 없다. 넣으면 이미 만든 시험지가 트리에서 다른 자리로 옮겨가고 ara-system 성적 시리즈 이름도 갈라진다
- 상태: `대기 → 읽는중 → 읽기완료 | 실패`. ⚠️ 어떤 길로 실패해도 **'읽는중' 으로 남기지 않는다**(영영 돌고 있는 것처럼 보인다). 취소로 시작조차 못 한 묶음은 '실패' 가 아니라 **'대기'** 다
- ⚠️ `page_paths` 는 `pages` 와 **같은 순서**다. 못 올린 쪽은 빈 문자열로 자리를 남긴다 — 압축하면 쪽 번호와 어긋나 엉뚱한 쪽 이미지가 옆에 붙는다
- 코드에서의 사용: `PrintBundle`, `PrintBundleStatus`, `runBundle`, `bundleBatches`, `register_words`
- 관련 파일: `src/lib/print-scan/run.ts`, `src/lib/print-scan/bundles.ts`, `sql/26_print_scans.sql`

## 손글씨 포함 (include_handwriting)
- 정의: 아이가 **손으로 적은 답·필기까지** 옮길지 여부. 묶음마다 고르고 기본은 꺼짐(인쇄된 활자만)
- 꺼짐: 손글씨는 무시하고 손으로 채운 빈칸도 `(   )` 로 남긴다. 켜짐: 손글씨를 `<em>` 으로 감싸 인쇄된 글과 구분한다(채점 표시 ○×✓ 는 양쪽 다 옮기지 않는다)
- 코드에서의 사용: `PrintBundle.include_handwriting`, `buildPrintOcrPrompt` 의 손글씨 블록
- 관련 파일: `src/lib/print-scan/prompt.ts`

## 문답 시험지 (print QA)
- 정의: 학교 프린트에 **이미 적혀 있는** 물음과 답을 문항으로 갈라 둔 것(`print_bundles.qa_items`). 광희중처럼 선생님이 `N. 물음 … 답: 정답` 꼴로 만든 프린트가 대상이다
- 같은 묶음의 **빈칸 시험지**(개념지)와 **다른 것**이다 — 둘은 같은 원문(`ocr_html`)에서 나오고 서로를 덮지 않는다. 화면도 다르다(`/print-sheets/[id]` vs `/print-sheets/[id]/qa`)
- 인쇄물 셋: **문제지**(답 없이 답 쓰는 줄) · **교사용**(문제 밑에 답) · **답지**(번호와 답, 근거 포함)
- ⚠️ 번호는 **프린트에 인쇄된 번호를 그대로** 찍는다(`numberPrintQaItems`). 새로 1번부터 매기지 않는다 — 선생님도 학생도 원본과 나란히 놓고 본다. 대신 문항을 빼면 번호가 빈다(감수한 값)
- ⚠️ 물음·답이 원문에 글자 그대로 없으면: **물음은 남기고 '원문과 달라요' 로 짚고**, **답은 비운다.** 문항이 통째로 사라지는 쪽이 더 나쁘고, 지어낸 답이 '인쇄된 답' 으로 들어가면 검증 없이 교사용에 찍힌다
- ⚠️ `ocr_html` 이 다시 읽혀 바뀌면 **지우지 않고 알린다**(`qa_meta.sourceHash` ↔ `isQaStale`) — 손으로 고친 답과 모범답안이 거기 들어 있다
- 코드에서의 사용: `PrintQaItem`, `qa_items`, `qa_meta`, `runPrintQaSplit`, `numberPrintQaItems`, `usePrintQa`
- 관련 파일: `src/lib/print-qa/`, `src/components/print-qa/`, `sql/31_print_bundle_qa.sql`

## 답 출처 (answerSource)
- 정의: 그 문항의 답이 **어디서 왔는가**. `printed`(프린트에 인쇄돼 있던 답) · `handwritten`(학생 손글씨) · `ai`(AI 모범답안) · `teacher`(선생님이 직접 씀) · `none`(아직 없음)
- 왜 가르나: 믿을 만한 정도가 전혀 다르다. 모범답안 **기본 대상은 `none`·`handwritten`** 이고, `ai` 답은 교사용·답지에 **출처와 근거를 함께** 찍어 선생님이 확인하게 한다
- 손글씨 판정은 `include_handwriting` 을 켜고 읽은 묶음의 **`<em>` 자리**로만 한다(`handwriting.ts`) — 모델에게 묻지 않는다. 끄고 읽었으면 손글씨는 아예 안 옮겨져 `none` 이 된다
- 손으로 고친 답은 `teacher` 가 되고 **근거를 함께 버린다**(`editAnswer`) — 답이 바뀌었는데 옛 근거가 남으면 거짓 근거가 된다
- 코드에서의 사용: `PrintQaAnswerSource`, `defaultAnswerTargets`, `answerTag`
- 관련 파일: `src/lib/print-qa/{items,print-format,handwriting}.ts`

## 모범답안 (model answer)
- 정의: 답이 비어 있거나 학생 필기뿐인 문항에 AI 가 **개념지·작품 전문·기출 지문·다른 프린트**를 근거로 지어 주는 답
- 참고자료는 `lib/quiz-references` 가 찾는다 — 신호는 **프린트 이름의 작품 부분 → 프린트에 인쇄된 작품명**(`qa_meta.work`) 순이고, 학교·학년·학년도가 함께 쓰인다. ⚠️ **자기 시험지는 후보에서 뺀다**(`excludeSheetId`)
- ⚠️ **근거를 못 찾아도 답은 버리지 않는다**(O,X·단답형과 다른 대접). 서술형은 자료를 종합해 쓰는 것이 보통이라 버리면 빈 문항만 남는다 — 대신 `evidenceSource: null` 로 두고 화면·교사용에 **'근거 없음'** 을 반드시 찍는다
- 근거를 찾는 차례는 **프린트 본문 → 참고자료** 다. 양쪽에 있으면 프린트로 적는다(선생님이 손에 든 것이 그 프린트다)
- 코드에서의 사용: `runPrintQaAnswers`, `parsePrintQaAnswers`, `applyGeneratedAnswers`, `qa_meta.references`
- 관련 파일: `src/lib/print-qa/{prompt-answers,parse-answers,run-answers}.ts`

## AI 추천 빈칸 (concept pick)
- 정의: 개념지 본문에서 빈칸으로 낼 용어를 AI 가 골라 **곧바로 마킹**하는 기능. 붙인 낱말을 칩으로 보여 주고 개별·전체 되돌리기가 있다. 개념지와 프린트 시험지 **양쪽**에서 쓴다(같은 편집기)
- ⚠️ 추천은 **띄어쓰기 없는 한 어절**이어야 한다. `extractMarks` 가 마킹 구간을 공백으로 쪼개 세므로, 구절을 고르면 빈칸이 여러 개가 되고 마킹 수(= 문항 수 = 합격 기준의 분모)가 부풀어 학원 성적까지 어긋난다
- ⚠️ 본문에 **글자 그대로** 있는 말만 쓴다. `addMarkByText` 는 한 텍스트 노드 안에서만 찾으므로 서식으로 쪼개진 구절은 못 붙이고, 그 개수를 사람에게 알린다
- **양은 개수가 아니라 밀도로 정한다**(2026-09-15 갱신). 선생님이 손으로 마킹한 개념지 120장(빈칸 8,100개)을 세어 나온 값 — 본문 1,000자당 52개 — 을 `CONCEPT_PICK_DENSITY_PER_100`(100자당 5개)로 프롬프트에 싣는다. 실측표는 [concept-pick-criteria.md](concept-pick-criteria.md) 에 있다. ⚠️ '장당 10개 안팎' 같은 절대 개수로 되돌리지 말 것 — 그 규칙으로 뚫은 프린트는 1,000자당 9~14개로 **선생님 기준의 1/5** 이었다
- **본문을 묶음으로 나눠 차례로 묻는다**(2026-09-15). `CONCEPT_PICK_CHUNK_CHARS`(1,000자)씩 줄 경계로 나누고(`chunkPlainText`) 묶음마다 한 번씩 AI 를 부른 뒤 **받는 즉시 마킹한다**. 취소하면 거기까지는 남는다. `CONCEPT_PICK_MAX_COUNT`(60)는 이제 **묶음 하나의 상한**이다
- 다시 누르면 '이미고른용어' 를 뺀 나머지에서 아직 외울 만한 것만 더 고르며, **빈 배열은 정상 응답**이다 — `conceptPickEmptyNotice` 가 셋을 가른다 — '더 추천할 용어가 없어요'(안내) / '고른 용어를 본문에 붙이지 못했어요'(서식으로 쪼개진 낱말) / '마킹할 용어를 찾지 못했어요'(검증에서 전부 걸러짐)
- **표·해설에서 고르고 작품 원문은 건드리지 않는다**(2026-09-15). 평문에 표는 `| 칸 | 칸 |`, 제목은 `#`, 목록은 `-` 로 남겨 모델이 원문과 해설을 가릴 수 있게 한다. 자리 규칙도 실측에서 나왔다 — 손 마킹의 **97.9% 가 표 안**이고 그중 대부분이 **라벨 칸이 아니라 오른쪽 내용 칸**이다. 학교 프린트 시험지는 표가 아니라 `N. 물음 … 답: 정답` 꼴이라 **'답:' 뒤 문장에만** 뚫는다(발문에 구멍이 나면 문제가 사라진다)
- **근거 한 줄(`reason`)은 받지 않는다**(2026-09-15). 한 묶음에 수십 개가 오는데 하나하나에 문장을 붙이면 출력 토큰이 곱절이 되어 기다리는 시간만 늘고, 사이드바에서는 아무도 읽지 않았다
- **자리 힌트(context)**: 추천마다 그 말이 있던 본문 구절을 함께 받는다. 같은 시어가 원문과 풀이표에 다 있을 때 **어디에 빈칸을 뚫을지** 정하는 재료다(`findMarkTarget`). 쓸 수 없는 힌트는 비우되 **추천은 버리지 않는다**
- 코드에서의 사용: `runConceptPick`, `chunkPlainText`, `parseConceptPicks`, `conceptPickEmptyNotice`, `findMarkTarget`, `useConceptPick`, `AiPickSection`
- 관련 파일: `src/lib/concept-pick/`, `src/hooks/useConceptPick.ts`, `src/components/exam-builder/AiPickSection.tsx`, `docs/concept-pick-criteria.md`

## 쪽 방향 판정 (page orientation)
- 정의: 스캔한 쪽이 바로 서 있는지 AI 에게 **먼저 묻고**, 뒤집혔으면 돌려서 읽는 단계. 학교 프린트 스캔에만 있다
- 작은 이미지(긴 변 900px)로 방향만 묻는다 — 글자를 읽을 필요가 없어 본문 읽기보다 훨씬 싸다
- ⚠️ **fail-open**: 판정이 실패하면 '돌리지 않음' 으로 두고 그냥 읽는다. 이 단계가 읽기를 막으면 안 된다
- ⚠️ `hasText` 는 빈 뒷면과 '글이 있는데 못 읽은 쪽' 을 가른다. 프롬프트가 "읽을 내용이 없는 쪽도 html 을 빈 문자열로" 라고 시키므로 **빈 본문만으로는 오류를 알 수 없다**
- 코드에서의 사용: `probePageOrientation`, `PageOrientation`, `PageRotation`
- 관련 파일: `src/lib/page-orientation/`, `src/lib/pdf/pdfRenderer.ts`

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

## 작품명 (work title)
- 정의: 지문에 실린 글의 제목(`passages.title`)과 그 지문에 딸린 문항이 물려받는 값(`problems.work_title`). 아카이브 왼쪽 '작품' 탭의 축이고 검색 평문(`search_text`)에도 들어간다
- 지은이는 **지문에만** 있다(`passages.author`) — 작품 트리가 `지은이 › 작품` 두 단이라 문항의 지은이는 제목으로 되찾는다(`facets.ts` 의 `collectPassageAuthors`)
- 표기 정규화는 `normalizeWorkTitle` ↔ DB `exam.normalize_work_title` **1:1 거울**이다 — 감싸는 기호(「」『』〈〉"")만 양끝에서 벗긴다. 한쪽만 바꾸면 같은 작품이 두 폴더로 갈라진다
- 지문 → 문항 전파는 **DB 트리거**가 한다(sql/20). 사람이 문항에 따로 적은 작품명은 보존된다
- OCR 은 작품명과 함께 **어디서 얻었는지**(`title_source`: `printed`/`inferred`)를 낸다. `inferred` 면 파서가 '본문으로 알아봤어요' 경고를 만들어 검수 화면에 그 지문을 짚어 준다 — 인쇄된 이름과 알아낸 이름을 구별할 수 있어야 틀렸을 때 고친다
- 코드에서의 사용: `Passage.title`, `Problem.work_title`, `normalizeWorkTitle`, `buildWorkTree`
- 관련 파일: src/lib/problem-bank/work-title.ts, src/lib/problem-bank/work-tree.ts, sql/20_problem_bank_works.sql

## 작품 후보 (work candidates)
- 정의: 기출 업로드 화면의 **'작품' 칸**에 자동으로 채워지는, 그 학교에 **이미 적혀 있는 작품명들**. 출처는 둘이다 — ① 학교 프린트 시험지의 프린트별 이름(`print_bundles.name` 에서 스캔 제목 접두를 벗긴 나머지), ② 같은 학교 기출 지문의 `passages.title`/`author`
- ⚠️ **저장하지 않는다.** OCR 프롬프트의 `작품후보` 로만 실려, 모델이 작품을 알아보고 **그 표기 그대로** 적게 한다(표기가 갈리면 작품 트리가 쪼개진다)
- 학년이 다른 줄은 후보에서 **뺀다**(작품은 학년마다 통째로 다르다). 학년도·학기·시험은 줄 세우기에만 쓴다
- 직접 고쳐 적은 값은 힌트가 덮지 않는다(`worksAuto`) — 교과서 자동 채움과 같은 계약이고, **칸을 비우는 것도 직접 고른 값**이다('이 시험지엔 작품 없음'). 자동은 학교·학교급을 바꿀 때 다시 켜진다
- 기출 지문 쪽 후보는 **검수를 마친(`완료`) 출처**의 것만 쓴다 — 아직 확인 안 된 추측이 다음 업로드의 표준 표기가 되면 틀린 이름이 스스로 번진다
- 코드에서의 사용: `WorkCandidate`, `rankWorkCandidates`, `toWorkHints`, `useWorkCandidates`, `SourceFormValues.works`
- 관련 파일: src/lib/problem-bank/work-candidates.ts, src/hooks/useWorkCandidates.ts, src/lib/problem-ocr/prompt-works.ts

## O,X·단답형 (passage quiz)
- 정의: 지문(문학 작품·비문학 글)을 넣으면 AI 가 만들어 주는 **O,X 문항과 단답형 문항**. `/problems/quiz`
- ⚠️ **저장하지 않는다.** DB 표가 없고 새로고침하면 사라진다 — 만들어 고치고 인쇄까지가 한 자리다
  (문항으로 저장하려면 `question_type` CHECK·출처 NOT NULL·인쇄 렌더러 3곳을 함께 고쳐야 한다)
- ⚠️ 근거 구절과 단답형 답이 지문 **또는 참고자료 하나**에 글자 그대로 있는지 기계가 대조한다(`foldStrict`).
  없으면 그 문항을 버리고 몇 개를 왜 뺐는지 화면에 적는다 — 프롬프트와 파서는 한 쌍이라
  한쪽만 느슨하게 하지 말 것
- 개수는 비우면 AI 가 정하고(유형마다 최대 `PASSAGE_QUIZ_MAX_PER_TYPE`), 숫자를 적으면 그만큼, 0 이면 안 낸다
- 기능 플래그는 `passage_quiz`(마스터는 `AI_OCR_BETA`)
- 코드에서의 사용: `runPassageQuiz`, `parsePassageQuiz`, `usePassageQuiz`, `QuizItem`, `numberQuizItems`
- 관련 파일: src/lib/passage-quiz/, src/hooks/usePassageQuiz.ts, src/components/passage-quiz/,
  src/app/(main)/problems/quiz/page.tsx, src/lib/problem-bank/passage-search.ts

## 참고자료 (quiz reference)
- 정의: 문제 만들기(O,X·단답형)가 지문과 **함께 읽는** 글. 네 곳에서 온다 —
  개념지 · 학교 프린트 시험지 원문 · 기출 지문 · 작품 전문
- 왜: 시험지에는 작품의 일부만 실린다. 잘린 지문만 보면 화자·정서·표현법처럼 **가르친 내용**을
  물을 수가 없는데, 그 내용은 이미 개념지와 프린트에 적혀 있다
- 고르는 법: **자동으로 붙이고 왜 붙었는지 밝힌다**(`reason`). 사람이 빼거나 더할 수 있고,
  ⚠️ **뺀 자료는 다시 찾기로 되살아나지 않는다**(`dismissedRef`)
- 자동 `QUIZ_REFERENCE_MAX_AUTO`(3)건 · 합쳐 `QUIZ_REFERENCE_MAX_TOTAL`(5)건 ·
  한 건은 `QUIZ_REFERENCE_TEXT_MAX`(15,000자)까지만 보내고 잘리면 화면에 '앞부분만 보냄' 을 띄운다
- ⚠️ **근거의 출처는 파서가 정한다**(`QuizItem.source`) — 모델에게 묻지 않는다. 지문을 먼저 보므로
  양쪽에 다 있는 구절은 지문(`''`)이고, 두 자료에 걸쳐 이어 붙인 근거는 버려진다
- 정답표는 참고자료에서 온 근거에 `[개념지 · 봄봄]` 처럼 자료 이름을 함께 찍는다
- 코드에서의 사용: `QuizReferenceText`, `AttachedReference`, `useQuizReferences`,
  `rankReferenceCandidates`, `fetchReferenceCandidates`
- 관련 파일: src/lib/quiz-references/, src/hooks/useQuizReferences.ts,
  src/components/passage-quiz/QuizReferencesSection.tsx, src/lib/passage-quiz/reference.ts

## 작품 전문 (ReferenceText)
- 정의: 개념 관리에 올려 두는 **작품 원문 전체**(sql/30 `exam.reference_texts`). `/reference-texts`
- ⚠️ 본문(`body`)은 **평문**이다(개념지의 `editor_html` 과 다르다) — 서식이 없고 화면은 텍스트 노드로 그린다
- 올리는 법: 붙여넣기 · `.txt` · **글자가 박힌** PDF. ⚠️ 스캔한 PDF 는 못 읽는다 —
  그때는 학교 프린트 시험지로 올리면 AI 가 읽어 준다(`pdfImportVerdict` 가 그 길을 알려 준다)
- ⚠️ PDF 가져오기는 `readPageText` 를 쓴다(`extractPageText` 아님) — 그쪽의 쪽당 200자 문턱은
  기출 OCR 용이라 시집처럼 쪽이 짧은 글이 통째로 빈다
- `char_count` 는 DB 트리거가 채운다 — 목록이 무거운 본문을 읽지 않고 길이를 보여 주려는 값이다
- 코드에서의 사용: `ReferenceText`, `ReferenceTextListItem`, `useReferenceTextEditor`
- 관련 파일: sql/30_reference_texts.sql, src/lib/reference-texts/, src/types/reference-text.ts,
  src/app/(main)/reference-texts/, src/components/reference-texts/

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
- 정의: 글로 옮기지 못한 문항·지문을 **통째로 잘라 둔 원본 이미지**로 인쇄하는 방식
- ⚠️ **마지막 수단이다.** 그림만 잘라 본문 제자리에 끼울 수 있으면(그림 자리표시자)
  글로 둔다 — 글이라야 고칠 수 있고 검색되고 문제지에서 다시 조판된다
- 코드에서의 사용: `render_mode`, `image_path`
- 관련 파일: src/lib/problem-ocr/crop.ts, src/components/problem-paper/PaperPrintBlocks.tsx

## 그림 자리표시자 (figure placeholder)
- 정의: 본문 HTML 안의 빈 `<figure data-figure="n"></figure>`. 그림이 **원래 있던 자리**를
  `<img>` 없이 남기는 표시다. 숫자는 `figure_paths` 배열의 **1-based 순번**이고,
  화면·인쇄가 그 자리에서 본문을 갈라 서명 URL 이미지를 끼운다
- 왜 URL 을 안 넣나: 그림은 비공개 버킷에 있어 **만료되는 서명 URL** 로만 열린다.
  만료된 URL 을 본문에 굳히면 인쇄물에서 빈칸이 된다
- 코드에서의 사용: `splitByFigurePlaceholders`, `reconcileFigurePlaceholders`,
  `shiftFigurePlaceholders`, `FigurePlaceholderNode`
- ⚠️ 편집기에 TipTap 노드가 없으면 글자 하나만 고쳐도 자리표시자가 사라진다
- 관련 파일: src/lib/problem-bank/figure-placeholders.ts,
  src/components/problem-editor/FigurePlaceholderNode.ts

## 참고 텍스트 (page text)
- 정의: PDF 에 **박혀 있는 글자**를 쪽마다 뽑아, 이미지와 **함께** 모델에게 주는 것.
  글자 하나하나는 이쪽이 정확하고, 구조(밑줄·상자·그림·문항 경계)는 이미지에서 본다
- ⚠️ 기출은 대부분 스캔본이라 **보통 비어 있다.** 있으면 공짜로 좋아지는 보너스다
- ⚠️ 복합기가 붙인 자동 OCR 레이어는 걸러낸다 — 우리가 쓰려는 것보다 못한 인식 결과라
  "정확한 글자" 라고 주면 오히려 더 틀린다
- 코드에서의 사용: `PageText`, `collectPageTexts`, `OcrMeta.textSource`
- 관련 파일: src/lib/pdf/pdfText.ts, src/lib/problem-ocr/page-text.ts

## 단 가르기 (column split)
- 정의: 2단 조판 쪽을 **단별 이미지 두 장**으로 나눠 보내는 것. 읽을 순서가 하나뿐이 되어
  두 단이 섞이지 않고, 같은 바이트가 절반의 넓이에 쓰여 글자가 커진다
- ⚠️ 홈(단 사이 여백)을 못 찾으면 **가르지 않는다** — 1단을 반으로 자르면 모든 줄이
  두 동강 난다
- 코드에서의 사용: `OCR_SPLIT_COLUMNS`, `detectGutter`, `RenderedImage.part`
- 관련 파일: src/lib/pdf/columnDetect.ts, src/lib/pdf/pdfColumns.ts

## 위아래 가르기 (row split)
- 정의: 한 조각(1단 쪽, 또는 켜 두면 단 하나)을 **빈 줄에서 위·아래 두 장**으로 나눠 보내는 것.
  한 장에 담는 글이 절반이 되어 글자가 더 큰 화소로 보인다(A4 1단 10pt 기준 13px → 18px)
- ⚠️ **이미지를 더 크게 보내는 것으로는 대신할 수 없다** — 모델이 자기 상한에 맞춰 도로 줄인다
- ⚠️ 빈 줄을 못 찾으면 **가르지 않는다**. 겹침은 최소 틈의 절반보다 작아, 겹친 부분이 빈 틈
  안에 머문다(같은 줄이 두 장에 나오면 모델이 두 번 옮긴다)
- ⚠️ **기출은 쓰지 않는다** — 그림 크롭이 쪽 기준 `top`·`bottom` 에 달려 있다
- 코드에서의 사용: `PRINT_SPLIT_ROWS`, `PRINT_SPLIT_COLUMN_ROWS`, `findRowGap`, `RenderedImage.part`
- 관련 파일: src/lib/pdf/rowDetect.ts, src/lib/pdf/pdfRows.ts, src/lib/pdf/pdfColumns.ts

## 추론 노력 (reasoning effort)
- 정의: 코덱스 턴 하나가 얼마나 오래 생각할지. 모델마다 지원 목록이 다르다(`model/list`)
- 안 보내면 선생님 PC `~/.codex/config.toml` 의 기본값으로 돈다 — 대개 낮은 노력이라
  **전사에서 글자가 바뀌는 오류**가 난다. 그래서 프린트 본문 읽기는 값을 **명시**한다
- ⚠️ 노력은 **모델 id 와 함께** 보내야 한다. 모델이 없으면 지원 목록을 몰라 노력이 버려진다
- ⚠️ 높은 노력은 반대 방향으로 틀린다 — 글을 **다듬는다**(마침표→쉼표, 비슷한 말로 바꾸기).
  프롬프트가 그 예를 들어 막는다
- 코드에서의 사용: `resolveOcrPref`, `PRINT_OCR_MODEL_PREFERENCE`, `PRINT_OCR_EFFORT_PREFERENCE`,
  `ocr_meta.model`·`ocr_meta.effort`
- 관련 파일: src/lib/ai/ocrPref.ts, src/lib/print-scan/constants.ts, src/lib/ai/codex/generateDraft.ts

## 화질 강등 (degraded page)
- 정의: 쪽 이미지가 바이트 예산을 못 맞춰 사다리 아래 칸(작게·낮은 화질)으로 인코딩된 것
- 노이즈가 많아 압축이 안 되는 스캔일수록 여기 걸리는데, 그런 쪽이 가장 안 읽힌다 —
  조용히 낮추지 말고 '확인 필요' 로 알린다
- ⚠️ **기록과 경고의 문턱이 다르다**: 한 칸이라도 내려가면 기록(`DEGRADED_STEP`),
  사람에게는 두 칸부터 알린다(`DEGRADED_WARN_STEP`). 한 칸은 큰 스캔에서 예사로 걸린다
- 코드에서의 사용: `encodeWithinBudgetStep`, `DEGRADED_STEP`, `DEGRADED_WARN_STEP`,
  `RenderedPages.degraded`(`{page, step}`), `ocr_meta.degradedPages`
- 관련 파일: src/lib/pdf/pdfBudget.ts, src/lib/print-scan/quality.ts

## 코덱스 브릿지 (Codex bridge)
- 정의: 선생님 PC 에서 도는 작은 중계 프로그램. 브라우저가 자기 ChatGPT 로 OCR 을 돌리게 해 준다. 학원 서버는 AI 를 호출하지 않는다
- 코드에서의 사용: `src/lib/ai/codex/*`, `ws://127.0.0.1:8899`
- 설치: 두 OS 모두 **Node.js + 한 번**이다. 윈도우는 파일 하나(`ara-ai.cmd`) 다운로드 후
  더블클릭, 맥은 터미널 한 줄(`install-mac.sh`). 둘 다 codex 설치 + ChatGPT 로그인 +
  브릿지 내려받기 + 자동 시작(맥은 LaunchAgent `kr.co.araeducation.ara-ai`, 윈도우는
  시작프로그램·바탕화면 바로가기 `ARA AI`)까지 한다. 둘 다 ara-system 이 호스팅한다.
- 갱신: 윈도우는 **켤 때마다 자동**(런처가 `bridge.cjs --update` 를 먼저 돌린다),
  맥은 설치 명령 재실행. ⚠️ 2026-09-12 이전의 윈도우 3파일 설치는 갱신 경로가 없어
  **한 번은 새 파일로 다시 설치**해야 한다. 맥의 codex 는 `~/.ara-ai/npm` 에 깔려 셸 PATH 에는 없다
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

## 옛한글 (Old Hangul) · 중세국어
- 정의: 지금은 안 쓰는 글자가 섞인 한글. 아래아 `ㆍ`, 반치음 `ㅿ`, 옛이응 `ㆁ`, 여린히읗 `ㆆ`,
  순경음 `ㅸ`, 어두 자음군 `ㅄ·ㅳ·ㅺ` 등. 국어 시험지에서는 훈민정음 언해·용비어천가·두시언해 같은
  중세국어 자료로 나온다
- 코드에서의 사용: `hasYetHangul`(감지 → 글꼴 클래스), `yetHangulPageWarning`(쪽 경고)
- 관련 파일: src/lib/yet-hangul/, src/app/globals.css(`.yet-hangul`·`.yet-hangul-serif`)
- ⚠️ **낱자 하나만 있는 글은 옛한글로 세지 않는다** — 'ㆍ의 소실' 을 묻는 문법 문항까지
  블록 글꼴이 바뀌면 안 된다

## 첫가끝 코드 (조합형 자모, conjoining jamo)
- 정의: 옛한글 음절을 **초성·중성·종성 자모를 순서대로 늘어놓아** 적는 유니코드 방식
  (초성 U+1100~115F·U+A960~, 중성 U+1160~11A7·U+D7B0~, 종성 U+11A8~11FF·U+D7CB~).
  글꼴의 `ljmo`·`vjmo`·`tjmo` 기능이 그 자모들을 한 글자 모양으로 합쳐 그린다.
  이 앱의 **저장 형태**다
- 코드에서의 사용: `composeSyllable`, `CHOSEONG`/`JUNGSEONG`/`JONGSEONG`
- 관련 파일: src/lib/yet-hangul/jamo-tables.ts, src/lib/yet-hangul/compose.ts
- ⚠️ 현대 한글은 완성형 음절(U+AC00~D7A3) 하나로 저장된다. 옛한글 음절은 **통째로 첫가끝**이라야
  한다 — `normalizeYetHangul` 이 NFC 뒤에 `가+ᇫ` 같은 섞인 모양을 다시 자모로 푼다(자모만 담은
  안전망 글꼴이 그 모양을 못 합친다). **NFKC 는 쓰면 안 된다**(호환 자모까지 바꾼다)

## 한양 PUA (Hanyang PUA)
- 정의: 아래아한글이 옛한글을 저장하던 사용자 정의 영역 코드(U+E0BC–F8F7). 표준이 아니라
  글꼴이 없으면 깨진 네모로 보이고, AI 에게는 뜻 없는 코드다
- 코드에서의 사용: `hanyangPuaCount`(옮길 수 있는 글자에서 뺀다), `markHanyangPua`(→ `〔옛〕`),
  `YET_HANGUL_MARKER`
- 관련 파일: src/lib/yet-hangul/detect.ts, src/lib/pdf/pdfText.ts
- ⚠️ `hasUsableText` 의 '깨진 글자' 판정에서 **이 구간은 뺀다** — 세면 중세국어 쪽의 PDF 글자
  레이어가 통째로 버려진다

## 방점 (tone mark)
- 정의: 중세국어에서 음절 왼쪽에 찍어 성조를 나타내던 점. 한 점(거성) U+302E, 두 점(상성) U+302F.
  **그 음절 바로 뒤**에 이어 적는다
- 코드에서의 사용: `TONE_MARKS`(`'.'`→한 점, `':'`→두 점), `composeSyllable`
- 관련 파일: src/lib/yet-hangul/jamo-tables.ts
- ⚠️ 결합 문자라 정규식 **문자 클래스에 넣으면 lint(`no-misleading-character-class`)에 걸린다**

## 옛한글 대체 표기 (⟦ ⟧)
- 정의: 모델이 조합형 자모를 못 낼 때 음절 하나를 **낱자로 풀어** 적게 하는 약속.
  `⟦ㅎㆍㄴ⟧` → `ᄒᆞᆫ`, 방점은 닫는 괄호 앞에 `.`·`:` (`⟦ㄴㆍ:⟧`)
- 코드에서의 사용: `convertYetHangulNotation`, `hasUnconvertedNotation`,
  `UNCONVERTED_NOTATION_WARNING`
- 관련 파일: src/lib/yet-hangul/compose.ts, src/lib/problem-ocr/normalize-html.ts,
  src/lib/print-scan/parse.ts
- ⚠️ 변환은 **정화보다 먼저**, 괄호 **밖**의 낱자는 건드리지 않는다. 못 바꾼 괄호는 남기고 경고한다
