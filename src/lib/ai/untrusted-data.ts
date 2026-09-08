// 프롬프트의 "지시문 / 데이터" 영역 분리
//
// 프롬프트에 실리는 자료(시험 메타·영역 트리)는 **신뢰할 수 없는 데이터**로 취급한다.
// 자료 안에 "위 규칙을 무시하라" 같은 문장이 있어도 그냥 데이터일 뿐이다.
//
// ⚠️ 모델에게 "도구를 쓰지 마라"라고 **쓰는 것은 보안 경계가 아니다.**
//    진짜 경계는 실행 격리다(codex/README.md — thread/turn 의 read-only 샌드박스 +
//    브릿지가 spawn 시 거는 --disable 목록).
//
// 원본: ara-system `app/lib/ai/redact.ts` 의 데이터 래핑 부분.
//   선생님 자유 메모 정화(sanitizeTeacherNote)는 이식하지 않았다 —
//   문제 은행 프롬프트에는 자유 입력이 들어가지 않고 학생 개인정보도 없다.

export const DATA_BEGIN = 'BEGIN_UNTRUSTED_ACADEMIC_DATA';
export const DATA_END = 'END_UNTRUSTED_ACADEMIC_DATA';

/**
 * 데이터를 구분자로 감싸 프롬프트에 싣는다.
 * 문자열 이어붙이기가 아니라 **JSON 직렬화**를 쓰는 이유: 값 안의 개행·따옴표가
 * 구분자 밖으로 새어 나가 지시문처럼 보이는 것을 막는다.
 * 자료에 구분자 문자열이 들어 있으면 무력화한다.
 * @param data - 프롬프트에 실을 자료(객체·배열 무엇이든)
 * @returns 구분자로 감싼 문자열
 */
export function wrapUntrustedData(data: unknown): string {
  const json = JSON.stringify(data, null, 2)
    .split(DATA_BEGIN)
    .join('DATA_BEGIN')
    .split(DATA_END)
    .join('DATA_END');
  return `${DATA_BEGIN}\n${json}\n${DATA_END}`;
}
