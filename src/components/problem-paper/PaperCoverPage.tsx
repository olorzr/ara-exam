import type { ReactNode } from 'react';
import { coverTitleFor, type CoverTitleSuffix, type PaperCover } from '@/lib/problem-paper/cover';

interface PaperCoverPageProps {
  cover: PaperCover;
  /** 찍을 제목 (`coverTitleFor` 로 교사용·답지 꼬리까지 붙인 값) */
  title: string;
  /** 그림 표지의 서명 URL — 아직 없으면 자리 안내만 그린다(인쇄는 페이지가 막는다) */
  imageUrl?: string;
  /** 그림을 끝내 못 받았는가 — 깨진 그림 대신 **인쇄물에도 보이는** 안내를 그린다 */
  imageFailed?: boolean;
}

/** 표지 그림을 못 받았을 때 표지 자리에 찍는 말 */
export const COVER_IMAGE_FAILED_NOTICE =
  '표지 그림을 불러오지 못했어요. 화면 위쪽의 \'다시 시도\' 를 누른 뒤 다시 인쇄해 주세요.';

/**
 * 표지 자리에 찍는 안내 한 장.
 *
 * ⚠️ 표지를 못 읽었거나 그림이 깨졌을 때 **인쇄물에도 보이게** 그린다. 인쇄 단추만 막으면
 *    Cmd/Ctrl+P 가 그것을 건너뛰어 빈 첫 장이 조용히 나간다(번호 어긋남 안내와 같은 규약,
 *    코덱스 1R). 중철에서도 표지 자리를 그대로 차지해 면 배정이 흔들리지 않는다.
 */
export function PaperCoverNotice({ message }: { message: string }) {
  return (
    <div className="pb-cover pb-cover--notice" role="alert">
      <p className="pb-cover__notice">{message}</p>
    </div>
  );
}

/** 이름 칸 — 학생이 손으로 적는다 */
const NAME_FIELDS = ['학교', '학년 · 반', '이름'] as const;

/**
 * 표지 내용. `A4CoverSheet` 안에 들어간다.
 *
 * 간단 표지는 학원 이름 · 큰 제목 · 부제 · 이름 칸이고, 그림 표지는 올린 그림을 종이에 맞춰
 * 비율을 지킨 채 담는다(잘리지 않는다 — 선생님이 만든 표지의 글자가 잘리면 안 된다).
 */
export default function PaperCoverPage({ cover, title, imageUrl, imageFailed = false }: PaperCoverPageProps) {
  if (cover.kind === 'image' && imageFailed) {
    return <PaperCoverNotice message={COVER_IMAGE_FAILED_NOTICE} />;
  }
  if (cover.kind === 'image') {
    return (
      <div className="pb-cover pb-cover--image">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pb-cover__image" src={imageUrl} alt={`${title} 표지`} />
        ) : (
          <span className="pb-cover__pending">표지 그림을 불러오는 중…</span>
        )}
      </div>
    );
  }

  return (
    <div className="pb-cover pb-cover--simple">
      <div className="pb-cover__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" width={24} height={24} />
        <span>아라국어논술</span>
      </div>

      <div className="pb-cover__main">
        <span className="pb-cover__accent" aria-hidden="true" />
        <h1 className="pb-cover__title">{title}</h1>
        {cover.subtitle && <p className="pb-cover__subtitle">{cover.subtitle}</p>}
      </div>

      {cover.showNameBox && (
        <dl className="pb-cover__names">
          {NAME_FIELDS.map((field) => (
            <div key={field} className="pb-cover__name-row">
              <dt>{field}</dt>
              <dd />
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/** 표지 자리 하나를 고르는 데 필요한 값 */
export interface CoverSlotInput {
  cover: PaperCover | null;
  paperTitle: string;
  /** 인쇄물 꼬리 — 문제지 '' · 교사용 ' - 교사용' · 답지 ' - 답지' */
  suffix: CoverTitleSuffix;
  imageUrl?: string;
  imageFailed?: boolean;
  /** 표지를 읽지 못했을 때의 안내 — 있으면 표지 대신 이것을 찍는다 */
  notice?: string;
}

/**
 * 표지 자리에 넣을 내용(문제지·교사용·답지가 같이 쓴다 — 두 벌로 두면 한쪽만 고쳐진다).
 * @param input - 표지와 상태
 * @returns 표지 낱장 내용. 표지가 없으면 undefined(표지 낱장을 그리지 않는다)
 */
export function renderCoverSlot(input: CoverSlotInput): ReactNode | undefined {
  if (input.notice) return <PaperCoverNotice message={input.notice} />;
  if (!input.cover) return undefined;
  return (
    <PaperCoverPage
      cover={input.cover}
      title={coverTitleFor(input.cover, input.paperTitle, input.suffix)}
      imageUrl={input.imageUrl}
      imageFailed={input.imageFailed}
    />
  );
}
