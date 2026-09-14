// 카테고리 마스터 데이터. 엔티티별 파일을 모아 재노출한다.
// (publishers · major_chapters · sub_chapters · schools · school_materials + 집계)
//
// ⚠️ 전부가 CRUD 인 것은 아니다:
//   - schools: 원본이 관리자시스템 `public.schools` 이고 여기 `exam.schools` 는 그 거울이라
//     조회 + `ensureSchoolMirror` 뿐이다(sql/27).
//   - school_materials: 프린트는 `학교 프린트 시험지` 업로드가 만든다(`ensureSchoolMaterial`).
//     조회 + 생성뿐이고 앱에 수정·삭제 경로가 없다(2026-09-14).
export * from './publishers';
export * from './major-chapters';
export * from './sub-chapters';
export * from './schools';
export * from './school-options';
export * from './school-materials';
export * from './aggregate';
