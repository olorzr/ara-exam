import { describe, it, expect } from 'vitest';
import { bundleDeleteConfirmMessage, scanDeleteConfirmMessage } from './scan-delete';

describe('scanDeleteConfirmMessage', () => {
  it('함께 사라지는 시험지 수를 반드시 밝힌다 — CASCADE 라 모르고 누르면 마킹까지 날아간다', () => {
    const message = scanDeleteConfirmMessage({
      title: '9월 프린트', bundleCount: 3, sheetCount: 2, running: false,
    });
    expect(message).toContain('프린트 3장');
    expect(message).toContain('시험지 2장도 함께 지워집니다');
    expect(message).toContain('학원 성적에 등록된 회차는 그대로 남습니다');
  });

  it('시험지가 없으면 시험지 얘기를 하지 않는다 — 조건이 다른 문장이 섞이면 거짓말이 된다', () => {
    const message = scanDeleteConfirmMessage({
      title: '빈 스캔', bundleCount: 1, sheetCount: 0, running: false,
    });
    expect(message).not.toContain('시험지');
    expect(message).not.toContain('성적');
  });

  it('읽는 중이면 그 결과가 저장되지 않는다고 알린다', () => {
    const message = scanDeleteConfirmMessage({
      title: 'x', bundleCount: 1, sheetCount: 0, running: true,
    });
    expect(message).toContain('읽는 중');
  });

  it('제목이 비어도 문장이 무너지지 않는다', () => {
    expect(scanDeleteConfirmMessage({ title: '', bundleCount: 0, sheetCount: 0, running: false }))
      .toContain('제목 없는 스캔');
  });
});

describe('bundleDeleteConfirmMessage', () => {
  it('시험지가 있을 때만 함께 지워진다고 알린다', () => {
    expect(bundleDeleteConfirmMessage({ name: '문학', hasSheet: true, running: false }))
      .toContain('시험지도 함께 지워집니다');
    expect(bundleDeleteConfirmMessage({ name: '문학', hasSheet: false, running: false }))
      .not.toContain('시험지');
  });
});
