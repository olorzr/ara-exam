// 코덱스 브릿지 설치 안내 상수
//
// 브릿지·설치 스크립트의 **원본은 ara-system 리포**(`public/ara-ai/`)에 있고,
// 선생님 PC 에는 그 한 벌만 깔린다 — 두 앱(ara-system, ara-exam)이 같은 브릿지를 공유한다.
// 여기서 파일을 다시 호스팅하면 포트 8899 를 두고 프로세스 둘이 다투게 되므로 하지 않는다.

/** 설치 파일을 내려받는 곳 (ara-system 프로덕션) */
export const ARA_AI_FILES_ORIGIN = 'https://www.araeducation.co.kr';

/** 설치 파일 목록 — 세 개를 **같은 폴더**에 받아야 동작한다 */
export const ARA_AI_FILES = [
  { name: 'install-autostart.cmd', desc: '이것만 두 번 눌러 설치합니다' },
  { name: 'start-codex.cmd', desc: '설치가 실행하는 시작 스크립트' },
  { name: 'bridge.cjs', desc: '브릿지 본체 (직접 실행하지 않습니다)' },
] as const;

/**
 * 이 앱이 요구하는 브릿지 최소 버전.
 *
 * ⚠️ v1 브릿지에는 ara-exam 주소가 허용 목록에 없어 **403 으로 거부**한다.
 *    브라우저에서는 그냥 "연결 실패"로만 보이고 버전을 알아낼 방법이 없다
 *    (핸드셰이크 이후는 raw TCP 라 우리가 물어볼 창구가 없다).
 *    그래서 연결이 실패하면 언제나 '다시 내려받기' 안내를 함께 띄운다.
 */
export const BRIDGE_MIN_VERSION = 2;
