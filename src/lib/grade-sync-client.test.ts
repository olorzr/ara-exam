import { describe, it, expect } from 'vitest';
import { gradeSyncFailureMessage } from './grade-sync-client';

describe('gradeSyncFailureMessage', () => {
  it('성공이면 경고하지 않는다', () => {
    expect(gradeSyncFailureMessage({ ok: true })).toBeNull();
  });

  it('마킹된 개념 단어가 없는 건 정상 skip 이라 경고하지 않는다', () => {
    expect(gradeSyncFailureMessage({ ok: false, skipped: true, reason: 'no_marks' })).toBeNull();
  });

  it('연동 미설정은 관리자 조치를 알린다 — 이 침묵이 2개월 장애의 원인이었다', () => {
    const message = gradeSyncFailureMessage({ ok: false, skipped: true, reason: 'not_configured' });
    expect(message).toContain('설정');
  });

  it('로그인 만료는 새로고침을 안내한다', () => {
    expect(gradeSyncFailureMessage({ ok: false, reason: 'unauthorized' })).toContain('로그인');
  });

  it('수신부 401 은 주소·시크릿 문제임을 짚는다', () => {
    const message = gradeSyncFailureMessage({ ok: false, reason: 'intake_failed', status: 401 });
    expect(message).toContain('시크릿');
  });

  it('수신부의 다른 오류는 상태 코드를 보여준다', () => {
    expect(gradeSyncFailureMessage({ ok: false, reason: 'intake_failed', status: 500 })).toContain('500');
  });

  it('409 는 원본 미등록이라고 짚어 준다 (재시험은 원본 회차에 붙는다)', () => {
    const msg = gradeSyncFailureMessage({ ok: false, reason: 'intake_failed', status: 409 });
    expect(msg).toContain('원본 시험지');
  });

  it('409 문항 수 잠금은 원본 미등록과 다르게 알린다 (이미 채점한 문제지·단어 시험)', () => {
    const msg = gradeSyncFailureMessage({
      ok: false, reason: 'intake_failed', status: 409, intakeCode: 'total_questions_locked',
    });
    expect(msg).toContain('문항 수');
    expect(msg).not.toContain('원본');
  });

  it('OMR 로 못 보내는 문제지는 라우트가 만든 문구(문항 번호 포함)를 그대로 쓴다', () => {
    const msg = gradeSyncFailureMessage({ ok: false, reason: 'omr_blocked', message: '3번 정답 미입력' });
    expect(msg).toBe('3번 정답 미입력');
  });

  it('문제지 사유도 사람 말로 알린다', () => {
    expect(gradeSyncFailureMessage({ ok: false, reason: 'omr_no_objective' })).toContain('객관식');
    expect(gradeSyncFailureMessage({ ok: false, reason: 'paper_not_found' })).toContain('문제지');
  });

  it('응답을 못 받으면 연결 실패로 알린다', () => {
    expect(gradeSyncFailureMessage(undefined)).toContain('연결');
  });

  it('모르는 사유도 조용히 넘기지 않는다', () => {
    expect(gradeSyncFailureMessage({ ok: false, reason: 'wat' })).toBe('등록에 실패했어요');
  });
});
