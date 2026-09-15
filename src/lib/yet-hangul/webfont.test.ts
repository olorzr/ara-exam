import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * 배포하는 옛한글 웹폰트가 **조합을 아는 그 파일인지** 고정한다.
 *
 * ⚠️ 왜 해시까지 박는가: 같은 저장소가 주는 `.woff2` 미러는 자모 조합 기능(`ljmo`·`vjmo`·
 *    `tjmo`)이 빠진 **다른 빌드**였다(내부 이름 `NanumBareunGothic…`). 그 파일을 쓰면
 *    `ᄒᆞᆫ` 이 한 글자로 합쳐지지 않고 자모 세 개가 나란히 찍히는데, 글자는 다 보여서
 *    **화면만 보고는 무엇이 잘못됐는지 알기 어렵다**. 그래서 OTF 원본에서 직접 변환하고
 *    그 결과를 여기 못 박는다 — 파일을 바꾸려면 public/fonts/README.md 의 확인 절차를
 *    거친 뒤 해시도 함께 고쳐야 한다.
 */

const FONTS: Record<string, string> = {
  // 안전망(자모·방점·옛 낱자·한양 PUA 만 담은 서브셋) — 스택에 늘 있으므로 작아야 한다
  'public/fonts/NanumBarunGothic-YetHangul-jamo.woff2':
    '4bc581cab5d4b8ebc0280a6e8680fcb9661a702bcf748da5beab149256371733',
  'public/fonts/NanumBarunGothic-YetHangul.woff2':
    'e6fbf09b15bae65b82f670938ccdf68b03a20cf5c4963985398e3ba60ad9ec2f',
  'public/fonts/NanumMyeongjo-YetHangul.woff2':
    '99850d7e75669a9e7309c1d47fb47b636213498ba3852818144b013a58d64880',
};

/** 안전망 얼굴의 상한 — 사파리는 옛 글자가 없는 쪽에서도 이 파일을 받는다(globals.css 주석) */
const SAFETY_NET_MAX_BYTES = 400_000;

describe('옛한글 웹폰트', () => {
  for (const [path, sha256] of Object.entries(FONTS)) {
    it(`${path} 는 조합을 확인한 그 파일이다`, () => {
      const buf = fs.readFileSync(path);
      expect(buf.toString('ascii', 0, 4)).toBe('wOF2');
      expect(crypto.createHash('sha256').update(buf).digest('hex')).toBe(sha256);
    });
  }

  it('globals.css 가 세 파일을 모두 부른다 — 하나만 걸면 그 자리만 조용히 깨진다', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    for (const path of Object.keys(FONTS)) {
      expect(css).toContain(`url('/${path.replace('public/', '')}')`);
    }
  });

  it('라이선스 전문을 함께 둔다 — OFL 은 재배포할 때 저작권 안내와 전문을 담으라고 한다', () => {
    const license = fs.readFileSync('public/fonts/LICENSE.txt', 'utf8');
    expect(license).toContain('SIL OPEN FONT LICENSE');
    expect(license).toContain('NHN Corporation');
  });

  it('안전망 얼굴은 작아야 한다 — 사파리가 옛 글자 없는 쪽에서도 받아 가기 때문이다', () => {
    const size = fs.statSync('public/fonts/NanumBarunGothic-YetHangul-jamo.woff2').size;
    expect(size).toBeLessThan(SAFETY_NET_MAX_BYTES);
  });

  it('`unicode-range` 가 걸린 얼굴은 안전망 하나뿐이다 — 큰 얼굴에 걸면 사파리가 통째로 받는다', () => {
    const css = fs.readFileSync('src/app/globals.css', 'utf8');
    const faces = css.match(/@font-face \{[^}]*\}/g) ?? [];
    const ranged = faces.filter((f) => f.includes('unicode-range') && f.includes('YetHangul'));
    expect(ranged).toHaveLength(1);
    expect(ranged[0]).toContain('NanumBarunGothic-YetHangul-jamo.woff2');
  });
});
