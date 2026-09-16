import { describe, expect, it } from 'vitest';
import { redactAnswerInQuestion, type RedactOptions } from './redact';

/** 글자만 견주는 자리 — 알림 여부는 `uncertain` 으로 따로 본다 */
const redact = (question: string, answer: string, options?: RedactOptions) =>
  redactAnswerInQuestion(question, answer, options).question;

/** 사람이 확인해야 한다고 알렸는가 */
const uncertain = (question: string, answer: string, options?: RedactOptions) =>
  redactAnswerInQuestion(question, answer, options).uncertain;

describe('redactAnswerInQuestion', () => {
  it('⚠️ 물음에 섞여 온 답을 잘라 낸다 — 안 그러면 문제지가 답을 찍는다 (코덱스 5R)', () => {
    expect(redact('서술자는 누구인가? 답: 나(소년)', '나(소년)'))
      .toBe('서술자는 누구인가?');
    expect(redact('갈래는? 정답: 소설', '소설')).toBe('갈래는?');
  });

  it('⚠️ 괄호에 채워진 답은 빈칸으로 되돌린다 — **물음 안쪽 답일 때만**', () => {
    const inside = { answerInsideQuestion: true };
    expect(redact('이 글의 갈래는 (소설)이다.', '소설', inside))
      .toBe('이 글의 갈래는 (　　　)이다.');
    expect(redact('갈래는 （소설）이다.', '소설', inside))
      .toBe('갈래는 (　　　)이다.');
  });

  it('⚠️ 따로 적힌 답이 있으면 괄호 속 말은 주어진 값이다 — 지우지 않는다 (코덱스 10R)', () => {
    expect(redact('다음 수의 절댓값을 구하시오. (5)', '5'))
      .toBe('다음 수의 절댓값을 구하시오. (5)');
  });

  it('⚠️ 물음 속의 낱말은 함부로 지우지 않는다 — 물을 것이 사라진다', () => {
    expect(redact("밑줄 친 '은유' 의 뜻은?", '은유'))
      .toBe("밑줄 친 '은유' 의 뜻은?");
  });

  it('비어 있는 답 표시는 자를 것이 없다', () => {
    expect(redact('서술자는? 답: ______', '')).toBe('서술자는? 답: ______');
  });

  it('정규식 기호가 든 답도 그대로 다룬다', () => {
    expect(redact('식은? (a+b)', 'a+b', { answerInsideQuestion: true }))
      .toBe('식은? (　　　)');
  });
});

describe('redactAnswerInQuestion — 코덱스 6R', () => {
  it('⚠️ 답을 못 뽑아냈어도 표시 뒤는 자른다 (블로킹)', () => {
    expect(redact('갈래는? 답: 소설', '')).toBe('갈래는?');
  });

  it('⚠️ 화살표로 적은 답도 자른다 — 프롬프트가 인정하는 꼴이다 (블로킹)', () => {
    expect(redact('갈래는? → 소설', '소설')).toBe('갈래는?');
    expect(redact('갈래는? ⇒ 소설', '')).toBe('갈래는?');
  });

  it('⚠️ 글자로 그린 화살표(->, =>)도 답이다 (코덱스 7R)', () => {
    expect(redact('갈래는? -> 소설', '')).toBe('갈래는?');
    expect(redact('갈래는? => 소설', '소설')).toBe('갈래는?');
  });

  it('⚠️ 인용 안에 글이 앞서 있어도 인용은 인용이다 (코덱스 7R)', () => {
    const q = "'그의 정답: 소설'에서 콜론의 기능은?";
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 글 속의 화살표는 자르지 않는다 — 물음이 끝난 자리에 온 것만 답이다', () => {
    expect(redact('A → B 의 변화를 설명하시오.', '변화'))
      .toBe('A → B 의 변화를 설명하시오.');
  });

  it('⚠️ 줄머리 화살표라도 물음이 안 끝났으면 자르지 않는다 — 그림이 사라진다 (코덱스 8R)', () => {
    const q = '다음 변화 과정을 보고\n→ 얼음 → 물 → 수증기\n각 단계에서 필요한 에너지를 쓰시오.';
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 표시 없이 줄만 바꿔 적은 답은 **지우지 않고 알린다** (코덱스 22R — 8R 을 뒤집음)', () => {
    // `다음 수의 절댓값을 구하시오.\n5` 와 구조가 똑같아 글자로는 가릴 수 없다.
    // 우리가 지우는 것은 프린트가 `답:`·괄호로 **답이라고 밝혀 둔 것**뿐이다
    const inside = { answerInsideQuestion: true };
    expect(redact('갈래는?\n소설', '소설', inside)).toBe('갈래는?\n소설');
    expect(uncertain('갈래는?\n소설', '소설', inside)).toBe(true);
  });

  it('표시가 있으면 그 줄의 답은 뗀다', () => {
    const inside = { answerInsideQuestion: true };
    expect(redact('갈래는?\n답:\n소설', '소설', inside)).toBe('갈래는?');
  });

  it('⚠️ 문제에 주어진 값은 지우지 않는다 — 풀 수 없는 문제가 된다 (Stop 게이트)', () => {
    const q = '다음 수의 절댓값을 구하시오.\n5';
    // 원문에서 답을 물음 **바깥**에서 찾았으면 그 5 는 주어진 값이다
    expect(redact(q, '5')).toBe(q);
    expect(redact(q, '5', { answerInsideQuestion: false })).toBe(q);
  });

  it('⚠️ 표시가 있으면 여러 줄짜리 답도 끝에서 뗀다 (코덱스 9R·22R)', () => {
    const inside = { answerInsideQuestion: true };
    expect(redact('두 가지를 쓰시오.\n답:\n은유\n직유', '은유\n직유', inside))
      .toBe('두 가지를 쓰시오.');
    // 표시가 없으면 선택지일 수 있어 남기고 알린다
    expect(redact('두 가지를 쓰시오.\n은유\n직유', '은유\n직유', inside))
      .toBe('두 가지를 쓰시오.\n은유\n직유');
  });

  it("⚠️ '답:' 다음 줄은 답인지 지시문인지 못 가린다 — 지우지 말고 알린다 (코덱스 10R)", () => {
    // 자르면 `답:\n다음 보기에서\n알맞은 말을 고르시오.` 같은 멀쩡한 물음이 깎인다.
    // 답을 뽑아냈으면 그 자리로 자르고(`answerInsideQuestion`), 못 뽑아냈으면 남기고 센다
    const q = '갈래는?\n답:\n소설';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
    expect(redact(q, '소설', { answerInsideQuestion: true })).toBe('갈래는?');
  });

  it('⚠️ 빈칸 뒤의 지시문을 지우지 않는다 — 그 줄까지만 보고 빈칸을 가린다 (코덱스 9R)', () => {
    const q = '다음 빈칸을 채우시오.\n답: ______\n그렇게 생각한 이유도 쓰시오.';
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 괄호형 빈 답란과 `~하라`·`~하세요` 지시문도 지키다 (Stop 게이트)', () => {
    const paren = '다음 빈칸을 채우시오.\n답: (     )\n그렇게 생각한 이유를 설명하라.';
    expect(redact(paren, '')).toBe(paren);
    const polite = '다음 빈칸을 채우시오.\n답:\n그렇게 생각한 이유를 설명하세요.';
    expect(redact(polite, '')).toBe(polite);
  });

  it('답과 다른 줄은 남긴다 — 물음이 여러 줄일 수 있다', () => {
    expect(redact('다음 중\n알맞은 것은?', '소설', { answerInsideQuestion: true }))
      .toBe('다음 중\n알맞은 것은?');
  });

  it('⚠️ 따옴표 안의 답 표시는 인용이다 — 물음이 그것을 묻고 있다', () => {
    const q = "'정답: 소설'에서 콜론의 기능을 설명하시오.";
    expect(redact(q, '설명')).toBe(q);
    expect(redact('「답: 가」의 뜻은?', '')).toBe('「답: 가」의 뜻은?');
  });

  it('⚠️ 인용 구간 안의 둘째 표시도 인용이다 — 멀쩡한 물음을 자르면 안 된다 (Stop 게이트)', () => {
    const q = '「답: 가, 정답: 나」에서 쉼표의 기능은?';
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 인용된 표시를 건너뛴 뒤에도 진짜 답을 찾아 자른다 (Stop 게이트)', () => {
    expect(redact('「답: 가」의 뜻은? 답: 나', '')).toBe('「답: 가」의 뜻은?');
    expect(redact("'정답: 소설'의 뜻은? → 갈래", '')).toBe("'정답: 소설'의 뜻은?");
    expect(redact('「답: 가, 정답: 나」의 뜻은? 답: 다', ''))
      .toBe('「답: 가, 정답: 나」의 뜻은?');
  });
});

describe('redactAnswerInQuestion — 코덱스 12R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 답 뒤에 이어지는 과제를 지우지 않는다 — 답만 빈칸으로 (블로킹)', () => {
    const out = redact(
      '갈래는? 답: 소설\n그 갈래의 특징 두 가지를 쓰시오.', '소설', inside,
    );
    expect(out).not.toContain('소설');
    expect(out).toContain('그 갈래의 특징 두 가지를 쓰시오.');
  });

  it('⚠️ 줄 나눔이 달라도 괄호 속 답을 찾아 빈칸으로 바꾼다 (블로킹)', () => {
    expect(redact('이 행동은 (관심\n표현)이다.', '관심 표현', inside))
      .toBe('이 행동은 (　　　)이다.');
  });

  it('⚠️ 빈칸이 표시 **앞**에 있어도 그 줄을 지키다 (블로킹)', () => {
    const q = '빈칸을 채우시오.\n______ (답: 명사)\n그 이유도 설명하시오.';
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 콜론 표시라도 그림 줄은 건드리지 않는다 (블로킹)', () => {
    const q = '다음 학생의 답에서 잘못된 단계를 찾으시오.\n답: 얼음 → 수증기 → 물\n이유도 설명하시오.';
    expect(redact(q, '')).toBe(q);
  });
});

describe('redactAnswerInQuestion — 코덱스 13R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 인용된 물음거리 대신 괄호 속 진짜 답을 가린다 (블로킹)', () => {
    const q = '‘아버지 가방에’를 올바르게 띄어 쓰면? (아버지가 방에)';
    const out = redact(q, '아버지가 방에', inside);
    // 인용된 '아버지 가방에' 는 물음거리라 그대로 있어야 한다
    expect(out).toContain('‘아버지 가방에’');
    expect(out).toBe('‘아버지 가방에’를 올바르게 띄어 쓰면? (　　　)');
    expect(uncertain(q, '아버지가 방에', inside)).toBe(false);
  });

  it('⚠️ 인용 안쪽뿐이면 지우지 않고 알린다 — 물을 것이 사라진다 (블로킹)', () => {
    const q = "'은유'의 뜻을 쓰시오.";
    expect(redact(q, '은유', inside)).toBe(q);
    expect(uncertain(q, '은유', inside)).toBe(true);
  });

  it('⚠️ 빈칸 만들기도 그림 줄은 건드리지 않는다 — 떼기만 막으면 소용없다 (블로킹)', () => {
    const q = '다음 학생의 답에서 잘못된 단계를 찾으시오.\n답: 얼음 → 수증기 → 물\n이유도 설명하시오.';
    expect(redact(q, '얼음 → 수증기 → 물', inside)).toBe(q);
    expect(uncertain(q, '얼음 → 수증기 → 물', inside)).toBe(true);
  });

  it('⚠️ 배점이 붙어 있어도 뒤의 과제를 자르지 않는다 (블로킹)', () => {
    const q = '갈래는? 답: 소설. 그 갈래의 특징 두 가지를 쓰시오. (2점)';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it('⚠️ 배점만 붙은 답은 그대로 자른다 — 규칙이 답까지 지켜 주면 안 된다', () => {
    expect(redact('갈래는? 답: 소설 (2점)', '')).toBe('갈래는?');
  });

  it('⚠️ 두 줄로 적은 답의 뒷줄이 남으면 알린다 (블로킹)', () => {
    const q = '이 인물의 태도를 설명하시오. 답: 상대를 존중하고\n상대의 처지를 배려한다.';
    const out = redact(q, '');
    expect(out).toBe('이 인물의 태도를 설명하시오.\n상대의 처지를 배려한다.');
    expect(uncertain(q, '')).toBe(true);
  });

  it('⚠️ 답을 아는 경우에만 말끝로 가린다 (코덱스 29R — 13R 의 말끝 규칙을 좁힘)', () => {
    const q = '갈래는? 답: 소설\n그 갈래의 특징 두 가지를 쓰시오.';
    expect(redact(q, '')).toBe('갈래는?\n그 갈래의 특징 두 가지를 쓰시오.');
    // 답을 모르면 뒷줄이 답인지 지시문인지 알 수 없다 — 국어는 말끝이 같다
    expect(uncertain(q, '')).toBe(true);
    // 답을 알면 그 줄을 이미 걷어냈으므로 남은 지시문에는 경고를 붙이지 않는다
    expect(uncertain(q, '소설', { answerInsideQuestion: true })).toBe(false);
  });
});

describe('redactAnswerInQuestion — 코덱스 14R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 낱말 한복판의 답은 표시가 아니다 — 대화 자료를 자르면 안 된다 (블로킹)', () => {
    const q = '다음 대화에서 높임 표현을 찾으시오.\n질문: 어디 가세요?\n대답: 학교에 갑니다.';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(false);
  });

  it('⚠️ 띄어쓰기만 다른 선택지를 지우지 않는다 — 고를 것이 사라진다 (블로킹)', () => {
    const q = '올바르게 띄어 쓴 문장을 고르시오.\n아버지가 방에\n아버지 가방에';
    expect(redact(q, '아버지가 방에', inside)).toBe(q);
    expect(uncertain(q, '아버지가 방에', inside)).toBe(true);
  });

  it('⚠️ 표시로 밝혀 둔 끝 줄 답은 그대로 뗀다 — 선택지 보호가 답까지 지켜 주면 안 된다', () => {
    expect(redact('갈래는?\n답:\n소설', '소설', inside)).toBe('갈래는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 15R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 표시 뒤의 답을 자르고 선택지는 남긴다 — 차례가 뒤집히면 둘 다 틀린다 (블로킹)', () => {
    const q = '은유와 직유 중 이 시의 표현법은? 답: 은유';
    // 빈칸을 먼저 넣으면 그 빈칸 때문에 진짜 답을 못 자르고 선택지만 지워졌다
    expect(redact(q, '은유', inside)).toBe('은유와 직유 중 이 시의 표현법은?');
    expect(uncertain(q, '은유', inside)).toBe(false);
  });

  it('⚠️ 마지막 줄 선택지를 답으로 보고 떼지 않는다 (블로킹)', () => {
    const q = '올바르게 띄어 쓴 문장을 고르시오.\n아버지 가방에\n아버지가 방에';
    expect(redact(q, '아버지가 방에', inside)).toBe(q);
    expect(uncertain(q, '아버지가 방에', inside)).toBe(true);
  });

  it('⚠️ 여러 줄에 걸친 인용 안의 답 표시는 자료다 (블로킹)', () => {
    const q = '다음 대화의 문제점을 쓰시오.\n“질문: 어디 가니?\n답: 학교에 갑니다.”';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it("⚠️ 같은 글자로 여닫는 따옴표는 한 줄 안에서만 인용이다 — 줄을 넘기면 답이 남는다", () => {
    // 아래 `'` 는 짝이 아니다(줄이 다르다) — 뒤의 진짜 답은 그대로 잘려야 한다
    expect(redact("친구의 말 '어디 가니?\n갈래는? 답: 소설", '')).toBe("친구의 말 '어디 가니?\n갈래는?");
  });

  it('답 줄을 뗀 뒤 남은 표시 줄도 정리한다', () => {
    expect(redact('갈래는?\n답:\n소설', '소설', inside)).toBe('갈래는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 16R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 표시로 답을 걷어냈으면 선택지는 건드리지 않는다 (블로킹)', () => {
    const q = '은유, 직유 중 표현법을 고르시오. 답: 은유';
    expect(redact(q, '은유', inside)).toBe('은유, 직유 중 표현법을 고르시오.');
    // 고를 말이 물음에 남아 있는 것은 사실이라 **알리기는 한다**(지우지 않는다)
    expect(uncertain(q, '은유', inside)).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 17R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 두 줄로 적은 답의 뒷줄도 걷어낸다 — 말끝이 지시문 같아도 답이다 (블로킹)', () => {
    const q = '친구에게 해 줄 충고는?\n답: 서로 존중하고\n상대방의 말을 끝까지 들으세요.';
    const answer = '서로 존중하고\n상대방의 말을 끝까지 들으세요.';
    expect(redact(q, answer, inside)).toBe('친구에게 해 줄 충고는?');
    expect(uncertain(q, answer, inside)).toBe(false);
  });

  it('답과 다른 줄은 그대로 남긴다 — 뒤따르는 과제를 지우면 안 된다', () => {
    const q = '갈래는? 답: 소설\n그 갈래의 특징 두 가지를 쓰시오.';
    expect(redact(q, '소설', inside)).toBe('갈래는?\n그 갈래의 특징 두 가지를 쓰시오.');
  });

  it('⚠️ 표 칸 경계에서 멈춘다 — 옆 칸의 지문이 함께 사라지면 안 된다 (블로킹)', () => {
    expect(redact('갈래는?\n답: 소설 | 다음 글: 봄이 왔다.', '소설', inside))
      .toBe('갈래는?\n| 다음 글: 봄이 왔다.');
  });

  it('⚠️ 번호가 붙은 선택지도 지우지 않는다 (블로킹)', () => {
    const q = '다음 중 맞는 것을 고르시오.\n① 은유\n② 직유';
    expect(redact(q, '은유', inside)).toBe(q);
    expect(uncertain(q, '은유', inside)).toBe(true);
  });

  it('⚠️ 빈칸이 있는 줄은 빈칸 만들기도 건드리지 않는다 — 답 꼴 안내가 사라진다 (블로킹)', () => {
    const q = '다음 빈칸을 채우시오.\n답: ______ (답: 명사)';
    expect(redact(q, '명사', inside)).toBe(q);
    expect(uncertain(q, '명사', inside)).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 18R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 마침표가 붙은 선택지도 지우지 않는다 (블로킹)', () => {
    const q = '알맞은 표현법을 고르시오.\n① 은유.\n② 직유.';
    expect(redact(q, '은유', inside)).toBe(q);
    expect(uncertain(q, '은유', inside)).toBe(true);
  });

  it('⚠️ 한 줄에 답이 둘이면 둘 다 걷는다 (블로킹)', () => {
    const out = redact('갈래는? 답: 소설 | 다시 쓴 정답: 소설', '소설', inside);
    expect(out).not.toContain('소설');
    expect(out.startsWith('갈래는?')).toBe(true);
  });

  it('⚠️ 한 음절짜리 답의 둘째 줄도 걷는다 (블로킹)', () => {
    expect(redact('두 음절을 쓰시오. 답: 가\n나', '가\n나', inside)).toBe('두 음절을 쓰시오.');
  });
});

describe('redactAnswerInQuestion — 코덱스 19R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 표시 뒤 판정은 **제 칸까지만** 본다 — 앞 칸의 지시문이 사라지면 안 된다 (블로킹)', () => {
    const out = redact('갈래는? 답: 한 단어로 쓰시오. | 정답: 소설', '소설', inside);
    expect(out).toContain('한 단어로 쓰시오.');
    expect(out).not.toContain('소설');
  });

  it('⚠️ 답 뒤에 이어지는 과제를 지우지 않는다 — 답 자리까지만 자른다 (블로킹)', () => {
    expect(redact('갈래는? 답: 소설. 그 특징을 서술할 것.', '소설', inside))
      .toBe('갈래는? 그 특징을 서술할 것.');
  });

  it('⚠️ 답을 모르면 여러 문장짜리 꼬리는 자르지 않고 알린다 (블로킹)', () => {
    const q = '갈래는? 답: 소설. 그 특징을 서술할 것.';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it('⚠️ 자모 보기도 낱말이다 — `(ㄱㄴ)` 에서 `ㄱ` 만 지우지 않는다 (블로킹)', () => {
    const q = '다음 중 바른 것은 (ㄱㄴ)이다.';
    expect(redact(q, 'ㄱ', inside)).toBe(q);
  });
});

describe('redactAnswerInQuestion — 코덱스 20R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 답 뒤에 과제가 이어져도 선택지는 남기고 답만 걷는다 (블로킹)', () => {
    const q = '은유, 직유 중 표현법은? 답: 은유. 그 특징을 쓰시오.';
    expect(redact(q, '은유', inside)).toBe('은유, 직유 중 표현법은? 그 특징을 쓰시오.');
  });

  it('⚠️ 뒤쪽에 같은 낱말이 또 있어도 **표시 바로 뒤**까지만 자른다 (블로킹)', () => {
    expect(redact('갈래는? 답: 소설. 다음 보기에서 소설, 시를 비교할 것.', '소설', inside))
      .toBe('갈래는? 다음 보기에서 소설, 시를 비교할 것.');
  });

  it('⚠️ `~할 것.` 도 지시문이다 — 답 꼴 안내를 지우지 않는다 (블로킹)', () => {
    const q = '인물의 심정을 설명하시오.\n답: 한 문장으로 서술할 것.';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 21R', () => {
  it('⚠️ 표시와 같은 말이 답이어도 표시 글자를 답으로 보지 않는다 (블로킹)', () => {
    expect(redact('틀린 답의 반대말은? 정답: 정답', '정답', { answerInsideQuestion: true }))
      .toBe('틀린 답의 반대말은?');
  });
});

describe('redactAnswerInQuestion — 코덱스 23R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 따옴표로 끝난 줄을 답 표시로 보지 않는다 — 아래 선택지가 지워진다 (블로킹)', () => {
    const q = '다음 중 서사 갈래를 고르시오.\n"시"\n소설';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 괄호로 적은 선택지 줄도 줄 전체다 — 빈칸으로 바꾸지 않는다 (블로킹)', () => {
    const q = '다음 중 갈래를 고르시오.\n(소설)\n(시)';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 물음이 끝나지 않은 자리의 화살표는 답 표시가 아니다 (블로킹)', () => {
    const q = '다음 낱말을 읽으시오.\n소설 →\n시';
    expect(redact(q, '시', inside)).toBe(q);
  });

  it('물음이 끝난 자리의 화살표 뒤는 그대로 뗀다', () => {
    expect(redact('갈래는? →\n소설', '소설', inside)).toBe('갈래는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 24R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 인용된 표시 줄은 답 표시가 아니다 — 그 줄과 아래 줄이 사라진다 (블로킹)', () => {
    const q = '다음 두 표현을 비교하시오.\n“정답:”\n소설';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 그림의 화살표 줄도 답 표시가 아니다 — 앞 줄이 물음으로 끝나야 한다 (블로킹)', () => {
    const q = '다음 흐름의 마지막 단계를 고르시오.\n얼음\n→\n물';
    expect(redact(q, '물', inside)).toBe(q);
    expect(uncertain(q, '물', inside)).toBe(true);
  });

  it('물음 뒤의 화살표 줄 아래 답은 그대로 뗀다', () => {
    expect(redact('갈래는?\n→\n소설', '소설', inside)).toBe('갈래는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 25R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 여러 줄에 걸친 인용 안의 표시도 인용이다 (블로킹)', () => {
    const q = '다음 대화에 어울리는 말을 고르시오.\n"질문: 갈래는?\n답:"\n소설';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 전각 칸 구분자(｜)에서도 멈춘다 — 옆 칸의 지문이 사라진다 (블로킹)', () => {
    expect(redact('갈래는? 답: 모름｜다음 글: 봄이 왔다.', ''))
      .toBe('갈래는? ｜다음 글: 봄이 왔다.');
  });

  it('⚠️ 자모로 갈린 한글(NFD)에서도 `대답:` 은 자료다 (블로킹)', () => {
    const q = '다음 대화를 읽고 높임 표현을 고치시오.\n대답: 학교에 갑니다.'.normalize('NFD');
    expect(redact(q, '')).toBe(q);
  });
});

describe('redactAnswerInQuestion — 코덱스 26R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 그림의 끝 화살표를 정리하다 지우지 않는다 (블로킹)', () => {
    const q = '다음 도식의 빈 부분을 완성하시오.\n얼음\n→';
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 여러 줄 인용 안의 표시 줄도 인용이다 (블로킹)', () => {
    const q = '다음 대화에서 응답을 찾으시오.\n"질문: 갈래는?\n답:\n소설"';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 빈칸이 있는 줄의 표시로는 끝 줄을 떼지 않는다 (블로킹)', () => {
    const q = '다음 빈칸을 채우시오. ____ 답:\n명사';
    expect(redact(q, '명사', inside)).toBe(q);
    expect(uncertain(q, '명사', inside)).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 27R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 마침표 뒤 공백이 빠져도 둘째 과제를 지키다 (블로킹)', () => {
    const q = '갈래는? 답: 소설.다음 글을 읽고 물음에 답하자.';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it('⚠️ 칸이 남아 있으면 다음 줄은 답의 나머지가 아니다 (블로킹)', () => {
    const q = '갈래는? 답: 소설 | 다음 보기\n소설\n위 낱말의 품사를 쓰시오.';
    expect(redact(q, '소설', inside)).toBe('갈래는? | 다음 보기\n소설\n위 낱말의 품사를 쓰시오.');
  });

  it('줄 끝까지 잘라 낸 뒤의 답 나머지는 그대로 걷는다', () => {
    expect(redact('두 가지를 쓰시오. 답: 은유\n직유', '은유\n직유', inside))
      .toBe('두 가지를 쓰시오.');
  });
});

describe('redactAnswerInQuestion — 코덱스 28R', () => {
  it('⚠️ 숫자로 시작하는 둘째 과제도 지킨다 — 가리는 것은 소수점뿐이다 (블로킹)', () => {
    const q = '갈래는? 답: 소설.1번 보기와 비교하기';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it('소수점 답은 그대로 자른다', () => {
    expect(redact('길이는? 답: 1.5', '')).toBe('길이는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 29R', () => {
  it('⚠️ 지시문 말끝을 가진 답의 둘째 문장도 알린다 (블로킹)', () => {
    const q = '친구에게 할 충고를 두 문장으로 쓰시오.\n답: 자신의 생각만 내세우지 마라.'
      + '\n상대방의 말을 끝까지 들으세요.';
    expect(redact(q, '')).toContain('상대방의 말을 끝까지 들으세요.');
    expect(uncertain(q, '')).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 30R', () => {
  it('⚠️ 답을 몰라도 채워진 괄호는 알린다 (블로킹)', () => {
    const q = '이 글의 갈래는 (소설)이다.';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });

  it('번호·배점·빈 답란은 알리지 않는다 — 경고가 모든 문항에 붙으면 안 된다', () => {
    expect(uncertain('(가)에 들어갈 말은?', '')).toBe(false);
    expect(uncertain('다음 글을 읽고 답하시오. (2점)', '')).toBe(false);
    expect(uncertain('빈칸을 채우시오. (    )', '')).toBe(false);
  });
});

describe('redactAnswerInQuestion — 코덱스 31R', () => {
  it('⚠️ 줄을 넘는 괄호와 긴 괄호도 알린다 (블로킹)', () => {
    expect(uncertain('갈래는 (\n소설\n)이다.', '')).toBe(true);
    expect(uncertain('태도는 (상대방의 처지를 이해하고 끝까지 배려하는 태도)이다.', '')).toBe(true);
  });

  it('⚠️ 자모로 갈린 `답:`(NFD)도 답 표시다 (블로킹)', () => {
    expect(redact(`갈래는? ${'답'.normalize('NFD')}: 소설`, '')).toBe('갈래는?');
  });
});

describe('redactAnswerInQuestion — 코덱스 32R', () => {
  it('⚠️ 긴 서술형 답이 든 괄호도 알린다 — 길이 상한을 두면 안 된다 (블로킹)', () => {
    const fill = '상대방의 처지를 이해하고 존중해야 한다. '.repeat(20).trim();
    expect(uncertain(`바람직한 대화 태도를 서술하시오. (${fill})`, '')).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 33R', () => {
  it('⚠️ 자모로 갈린 지시문(NFD)도 지시문이다 (블로킹)', () => {
    const q = '갈래는? 답: 한 단어로 쓰시오.'.normalize('NFD');
    expect(redact(q, '')).toBe(q);
  });

  it('⚠️ 겹친 괄호 속의 채워진 답도 알린다 (블로킹)', () => {
    expect(uncertain('표현법은? (은유(ㄱ))', '')).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 34R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 안쪽에 빈칸이 있어도 채워진 괄호는 알린다 (블로킹)', () => {
    expect(uncertain('갈래는? (소설(__))', '')).toBe(true);
    // 속이 온통 빈칸인 답란은 그대로 조용하다
    expect(uncertain('빈칸을 채우시오. (    )', '')).toBe(false);
    expect(uncertain('빈칸을 채우시오. (____)', '')).toBe(false);
  });

  it('⚠️ 겹친 괄호로 적은 선택지 줄도 지우지 않는다 (블로킹)', () => {
    const q = '다음 보기에서 고르시오.\n((소설))\n((시))';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('겹친 괄호 속 답은 바깥까지 함께 빈칸으로 바꾼다', () => {
    expect(redact('이 글의 갈래는 ((소설))이다.', '소설', inside))
      .toBe('이 글의 갈래는 (　　　)이다.');
  });
});

describe('redactAnswerInQuestion — 코덱스 35R', () => {
  it('⚠️ 느낌표로 끝나는 지시문도 지시문이다 (블로킹)', () => {
    const q = '갈래는?\n답: 한 단어로 쓰시오!';
    expect(redact(q, '')).toBe(q);
    expect(uncertain(q, '')).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 36R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 표 한 행에 놓인 선택지도 지우지 않는다 (블로킹)', () => {
    const q = '다음 중 알맞은 것을 고르시오.\n| ① (소설) |\n| ② (시) |';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('⚠️ 여러 줄에 걸친 괄호도 빈칸 줄을 지킨다 (블로킹)', () => {
    const q = '다음 빈칸을 채우시오. ____ (\n소설\n)';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });

  it('멀쩡한 괄호 속 답은 그대로 빈칸으로 바꾼다', () => {
    expect(redact('이 글의 갈래는 (소설)이다.', '소설', inside))
      .toBe('이 글의 갈래는 (　　　)이다.');
  });
});

describe('redactAnswerInQuestion — 코덱스 37R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 칸이 나뉜 표의 선택지도 지우지 않는다 (블로킹)', () => {
    const q = '갈래를 고르시오.\n| ① | (소설) |\n| ② | (시) |';
    expect(redact(q, '소설', inside)).toBe(q);
    expect(uncertain(q, '소설', inside)).toBe(true);
  });
});

describe('redactAnswerInQuestion — 코덱스 38R', () => {
  const inside = { answerInsideQuestion: true };

  it('⚠️ 번호에 공백이 껴도 선택지 줄은 지우지 않는다 (블로킹)', () => {
    const spaced = '알맞은 갈래를 고르시오.\n( 1 ) (소설)\n( 2 ) (시)';
    expect(redact(spaced, '소설', inside)).toBe(spaced);
    const worded = '알맞은 갈래를 고르시오.\n문 1) (소설)\n문 2) (시)';
    expect(redact(worded, '소설', inside)).toBe(worded);
  });
});
