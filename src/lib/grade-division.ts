/**
 * ara-exam 카테고리(level/grade)를 ara-system 학교급(division)으로 매핑한다.
 * ara-system 수기 채점은 시험의 학교급으로 채점 대상 학생을 필터링하므로, 시험을 올바른
 * 학교급 시리즈에 꽂아야 대상 학생을 채점할 수 있다.
 *
 * @returns '초등부' | '중등부' | '고등부', 또는 판단 불가 시 null(→ ara-system 기본 중등부)
 */
export function levelGradeToDivision(level: string, grade: string): string | null {
  if (level === '중등') return '중등부';
  if (level === '고등') return '고등부';
  // 외부지문 등은 grade 접두사로 추정
  const g = (grade || '').trim();
  if (g.startsWith('고')) return '고등부';
  if (g.startsWith('중')) return '중등부';
  if (g.startsWith('초')) return '초등부';
  return null;
}

/**
 * 여러 카테고리에서 학교급을 결정한다. **단일 학교급으로 명확할 때만** 반환한다.
 * 0개(학교급 정보 없음) 또는 2개 이상(혼합)이면 null → ara-system 기본 학교급 처리.
 * (임의로 하나 고르면 다른 학교급 학생이 채점 대상에서 빠지므로 미상으로 둔다.)
 */
export function resolveSingleDivision(cats: { level: string; grade: string }[]): string | null {
  const set = new Set<string>();
  for (const c of cats) {
    const d = levelGradeToDivision(c.level, c.grade);
    if (d) set.add(d);
  }
  return set.size === 1 ? [...set][0] : null;
}
