# 옛한글 글꼴 (네이버 나눔 옛한글)

중세국어(훈민정음 언해·용비어천가 등)를 화면·인쇄에서 그리려고 **자체 호스팅**한다.
Pretendard 를 비롯한 기본 글꼴에는 첫가끝 조합형 자모(U+1100~, U+A960~, U+D7B0~)가 없어
그대로 두면 깨진 네모로 나온다.

| 파일 | 내용 | 크기 | 쓰는 곳 |
| --- | --- | --- | --- |
| `NanumBarunGothic-YetHangul-jamo.woff2` | 나눔바른고딕 옛한글 **부분 글꼴** — 자모·방점·옛 낱자·한양 PUA 만. 글꼴 안 이름은 `AraExam Yet Jamo` | 272,764 B | 안전망(기본 스택 뒤) |
| `NanumBarunGothic-YetHangul.woff2` | 나눔바른고딕 옛한글 **전체** | 1,679,728 B | `.yet-hangul` — 발문·선지·개념지 |
| `NanumMyeongjo-YetHangul.woff2` | 나눔명조 옛한글 **전체** | 2,450,984 B | `.yet-hangul-serif` — 옛한글 지문 |

## 라이선스

- 저작권: NHN Corporation(현 NAVER Corporation), 2014. 디자인 폰트릭스(FONTRIX Inc.)
- **SIL Open Font License 1.1** — 전문은 같은 폴더의 [LICENSE.txt](LICENSE.txt).
  네이버가 밝힌 조건: 개인·기업 모두 무료, **글꼴 자체를 파는 것만** 금지, 저작권 안내와 라이선스
  전문을 함께 담으면 번들·재배포·수정이 자유롭다(https://hangeul.naver.com/font).
- 여기 있는 파일은 공식 **OTF 를 형식 변환**(WOFF2)한 것이고, `-jamo` 파일은 거기서 **글자 범위를
  잘라 낸 부분 글꼴**이다. **글리프 모양은 한 자도 손대지 않았다.**
- ⚠️ **지정 글꼴명(Reserved Font Name) 조항.** OFL 은 수정본이 지정 글꼴명(`Nanum`·
  `NanumBarunGothic`·`NanumMyeongjo`)을 쓰지 못하게 한다. 그래서 둘로 갈랐다:
  - **전체 글꼴 둘**은 글리프·표를 하나도 안 바꾼 **형식 변환(압축)** 이라 원본 이름을 유지한다
    — 웹폰트 배포의 통상 관행이다.
  - **부분 글꼴**은 글자를 덜어 낸 진짜 수정본이므로 글꼴 안 이름을 **`AraExam Yet Jamo`** 로
    바꿔 두었다(저작권·상표 고지는 원본 그대로 남긴다). CSS 의 `font-family` 는 우리가 정한
    이름이라 이 변경이 화면에 영향을 주지 않는다.

## ⚠️ 미러의 woff2 를 그대로 가져다 쓰지 말 것 (2026-09-15에 실제로 겪음)

`fonts-archive` 저장소가 주는 `.woff2`·`.woff` 는 **자모 조합 기능(`ljmo`·`vjmo`·`tjmo`)이 빠진
다른 빌드**다(글꼴 안 이름이 `NanumBareunGothicOTF-YetHangul` — *Bareun* 철자가 다르다).
그 파일로는 `ᄒᆞᆫ` 이 한 글자로 합쳐지지 않고 **자모 세 개가 나란히** 찍히는데, 글자는 다 보이므로
화면만 보고는 원인을 못 찾는다. 같은 저장소의 `.otf` 는 멀쩡하다 — **OTF 를 받아 직접 변환한다.**

## 만드는 법

```bash
python3 -m venv fontenv && ./fontenv/bin/pip install fonttools brotli
curl -LO https://cdn.jsdelivr.net/gh/fonts-archive/NanumBarunGothic-YetHangul/NanumBarunGothic-YetHangul.otf
curl -LO https://cdn.jsdelivr.net/gh/fonts-archive/NanumMyeongjo-YetHangul/NanumMyeongjo-YetHangul.otf

# ① 전체 글꼴 둘 — 형식 변환만 한다
./fontenv/bin/python -c "
from fontTools.ttLib import TTFont
for src in ['NanumBarunGothic-YetHangul', 'NanumMyeongjo-YetHangul']:
    f = TTFont(src + '.otf'); f.flavor = 'woff2'; f.save(src + '.woff2')"

# ② 안전망 부분 글꼴 — 범위는 globals.css 의 unicode-range 와 같아야 한다
./fontenv/bin/pyftsubset NanumBarunGothic-YetHangul.otf \
  --unicodes="U+1100-11FF,U+A960-A97F,U+D7B0-D7FF,U+302E-302F,U+3165-318E,U+E0BC-F8F7" \
  --layout-features+=ljmo,vjmo,tjmo,ccmp,aalt --notdef-outline --no-hinting \
  --output-file=subset.otf

# ③ 부분 글꼴은 **수정본**이라 지정 글꼴명을 못 쓴다 — 이름만 바꾸고 저작권 고지는 남긴다
./fontenv/bin/python -c "
from fontTools.ttLib import TTFont
f = TTFont('subset.otf'); name = f['name']
for rec in list(name.names):
    nid, args = rec.nameID, (rec.platformID, rec.platEncID, rec.langID)
    if nid == 1: name.setName('AraExam Yet Jamo', 1, *args)
    elif nid == 2: name.setName('Regular', 2, *args)
    elif nid == 3: name.setName('AraExamYetJamo; subset of NanumBarunGothicOTF-YetHangul (jamo/tone/PUA only)', 3, *args)
    elif nid == 4: name.setName('AraExam Yet Jamo', 4, *args)
    elif nid == 6: name.setName('AraExamYetJamo', 6, *args)
    elif nid in (16, 17, 18, 20, 21, 22): name.removeNames(nid)
f.flavor = 'woff2'; f.save('NanumBarunGothic-YetHangul-jamo.woff2')"
```

바꾼 뒤에는 **반드시 조합을 눈으로 확인한다**(`ᄒᆞᆫ` 이 한 글자로 보이는지).
파일을 갈아 끼우면 아래 해시가 달라져 [webfont.test.ts](../../src/lib/yet-hangul/webfont.test.ts)
가 실패한다 — 확인을 마친 뒤 해시도 함께 고칠 것.

```
4bc581cab5d4b8ebc0280a6e8680fcb9661a702bcf748da5beab149256371733  NanumBarunGothic-YetHangul-jamo.woff2
e6fbf09b15bae65b82f670938ccdf68b03a20cf5c4963985398e3ba60ad9ec2f  NanumBarunGothic-YetHangul.woff2
99850d7e75669a9e7309c1d47fb47b636213498ba3852818144b013a58d64880  NanumMyeongjo-YetHangul.woff2
```

## 이 파일들로 실제 확인한 것 (2026-09-15)

macOS CoreText 로 조판해 글리프 수와 너비를 쟀고, WebKit 으로 실제 렌더까지 봤다.

- `ᄒᆞᆫ`·`ᄡᆞᆯ`(어두 자음군)·`ᄉᆞ`·`ᅀᅡ`(반치음)·`ᅌᅧᇰ`(옛이응) 이 **코드포인트 2~3개 → 글리프 1개,
  너비 한 칸**으로 합쳐진다(= `ljmo`·`vjmo`·`tjmo` 가 돈다). 빠진 글자(notdef) 없음
- 방점 U+302E·U+302F 가 음절 왼쪽에 찍힌다(한 칸보다 0.3칸쯤 넓어진다)
- 한양 PUA(U+E0BC–F8F7) 5,324자 — 아래아한글이 만든 옛 문서도 그려진다(부분 글꼴에도 들었다)
- 전체 글꼴에는 한자 4,621자와 완성형 11,172자가 다 들어 있다 — 블록을 통째로 이 글꼴로 그려도
  현대 글자·한자 병기가 안 깨진다
- ⚠️ **부분 글꼴에는 완성형 글자가 없다.** 그래서 저장 형태를 **첫가끝으로 통일**한다 — NFC 가
  남기는 섞인 모양(`가`+`ᇫ`, `바`+`ᇰ`)은 부분 글꼴이 합치지 못해 두 글자로 쪼개져 보인다
  (전체 글꼴 둘은 그 모양도 한 글자로 합친다). [compose.ts](../../src/lib/yet-hangul/compose.ts)
  의 `normalizeYetHangul` 이 그 규칙이다

## ⚠️ 왜 안전망만 부분 글꼴인가

**WebKit(사파리)은 `unicode-range` 와 무관하게, 글꼴 스택에 있기만 하면 그 웹폰트를 내려받는다**
(실측: 옛 글자가 한 자도 없는 쪽에서도 `document.fonts` 의 status 가 `loaded`). 크롬·파이어폭스는
건너뛴다. 기본 스택(`--font-sans`)에 얹는 얼굴은 그래서 **작아야** 하고, 큰 얼굴 둘은 감지 클래스
(`.yet-hangul`·`.yet-hangul-serif`)에만 건다 — 옛한글이 실제로 있는 화면에서만 받는다.

## 왜 CDN 을 직접 참조하지 않는가

`font-src` 에 jsdelivr 가 열려 있지만([next.config.ts](../../next.config.ts)) 제3자 미러에
런타임을 매달면 그 저장소가 사라질 때 옛한글이 조용히 깨진다. 자체 호스팅이면 CSP 도 그대로다.

## 글꼴을 갈아 끼울 때

`@font-face` 세 벌과 `unicode-range` 는 [globals.css](../../src/app/globals.css) 에 있고,
그 범위는 [detect.ts](../../src/lib/yet-hangul/detect.ts) 의 `YET_HANGUL_UNICODE_RANGE` 와
글자 그대로 같아야 한다(테스트가 두 파일을 대조한다).
