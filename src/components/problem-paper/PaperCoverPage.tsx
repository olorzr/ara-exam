import type { ReactNode } from 'react';
import { coverTitleFor, type CoverTitleSuffix, type PaperCover } from '@/lib/problem-paper/cover';
import { toCoverLayoutProps } from '@/lib/problem-paper/cover-text';
import { BackCover, COVER_LAYOUT_COMPONENTS } from './covers';

interface PaperCoverPageProps {
  cover: PaperCover;
  /** 찍을 제목 (`coverTitleFor` 로 교사용·답지 꼬리까지 붙인 값) */
  title: string;
  /** 그림 표지의 서명 URL — 아직 없으면 자리 안내만 그린다(인쇄는 페이지가 막는다) */
  imageUrl?: string;
  /** 그림을 끝내 못 받았는가 — 깨진 그림 대신 **인쇄물에도 보이는** 안내를 그린다 */
  imageFailed?: boolean;
  /** 문제지를 만든 해('2026') — 디자인 표지가 찍는다. 모르면 비운다 */
  year?: string;
  /** 디자인 표지의 선생님 이름(`coverTeacherName`). 비면 그 줄을 그리지 않는다 */
  teacher?: string;
}

/** 표지 그림을 못 받았을 때 표지 자리에 찍는 말 */
export const COVER_IMAGE_FAILED_NOTICE =
  '표지 그림을 불러오지 못했어요. 화면 위쪽의 \'다시 시도\' 를 누른 뒤 다시 인쇄해 주세요.';

/** 뒷표지 그림을 못 받았을 때 뒷표지 자리에 찍는 말 */
export const BACK_COVER_IMAGE_FAILED_NOTICE =
  '뒷표지 그림을 불러오지 못했어요. 화면 위쪽의 \'다시 시도\' 를 누른 뒤 다시 인쇄해 주세요.';

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

/**
 * 표지 내용. `A4CoverSheet` 안에 들어간다.
 *
 * 간단 표지는 고른 디자인(`cover.layout` → `COVER_LAYOUT_COMPONENTS`)으로 그리고, 그림 표지는 올린 그림을
 * 종이에 맞춰 비율을 지킨 채 담는다(잘리지 않는다 — 선생님이 만든 표지의 글자가 잘리면 안 된다).
 */
export default function PaperCoverPage({
  cover, title, imageUrl, imageFailed = false, year = '', teacher = '',
}: PaperCoverPageProps) {
  if (cover.kind === 'image' && imageFailed) {
    return <PaperCoverNotice message={COVER_IMAGE_FAILED_NOTICE} />;
  }
  if (cover.kind === 'image') return <CoverImage url={imageUrl} alt={`${title} 표지`} />;

  const Layout = COVER_LAYOUT_COMPONENTS[cover.layout];
  return (
    <Layout
      {...toCoverLayoutProps({ title, subtitle: cover.subtitle, showNameBox: cover.showNameBox, year, teacher })}
    />
  );
}

/** 그림 한 장 — 종이에 맞춰 비율을 지킨 채 담는다(잘리지 않는다) */
function CoverImage({ url, alt }: { url?: string; alt: string }) {
  return (
    <div className="pb-cover pb-cover--image">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pb-cover__image" src={url} alt={alt} />
      ) : (
        <span className="pb-cover__pending">표지 그림을 불러오는 중…</span>
      )}
    </div>
  );
}

interface PaperBackCoverPageProps {
  cover: PaperCover;
  /** 문서 제목(그림 대체 글에 쓴다) */
  title: string;
  imageUrl?: string;
  imageFailed?: boolean;
  year?: string;
}

/**
 * 뒷표지 내용 — 디자인 짝(`BackCover`, 앞표지 디자인을 따른다) 또는 올린 그림. `backKind` 가 `none` 이면 그리지 않는다.
 * 그림을 끝내 못 받았으면 **인쇄물에도 보이는** 안내를 그린다(앞표지와 같은 규약).
 */
export function PaperBackCoverPage({ cover, title, imageUrl, imageFailed = false, year = '' }: PaperBackCoverPageProps) {
  if (cover.backKind === 'image' && imageFailed) {
    return <PaperCoverNotice message={BACK_COVER_IMAGE_FAILED_NOTICE} />;
  }
  if (cover.backKind === 'image') return <CoverImage url={imageUrl} alt={`${title} 뒷표지`} />;
  if (cover.backKind === 'design') return <BackCover layout={cover.layout} year={year} />;
  return null;
}

/** 표지 그림의 서명 URL 과 깨짐 — `useCoverImages` 가 주는 값 가운데 그리는 데 필요한 것 */
export interface CoverSlotImages {
  frontUrl?: string;
  backUrl?: string;
  frontBroken?: boolean;
  backBroken?: boolean;
}

/** 표지 자리(앞·뒤)를 고르는 데 필요한 값 */
export interface CoverSlotInput {
  cover: PaperCover | null;
  paperTitle: string;
  /** 인쇄물 꼬리 — 문제지 '' · 교사용 ' - 교사용' · 답지 ' - 답지' */
  suffix: CoverTitleSuffix;
  /** 표지 그림(앞·뒤) */
  images?: CoverSlotImages;
  /** 표지를 읽지 못했을 때의 안내 — 있으면 표지 대신 이것을 찍고 뒷표지는 그리지 않는다 */
  notice?: string;
  /** 문제지를 만든 해(`coverYearOf(paper.created_at)`) */
  year?: string;
  /** 디자인 표지의 선생님 이름(`coverTeacherName`) */
  teacher?: string;
}

/** 표지 자리 둘 — 없으면 그 낱장을 그리지 않는다 */
export interface CoverSlots {
  coverPage?: ReactNode;
  backCoverPage?: ReactNode;
}

/**
 * 표지 자리에 넣을 내용(문제지·교사용·답지가 같이 쓴다 — 두 벌로 두면 한쪽만 고쳐진다).
 * 결과를 그대로 `A4Document` 에 펼친다(`{...renderCoverSlots(…)}`).
 * @param input - 표지와 상태
 * @returns 앞표지·뒷표지 낱장 내용. 없으면 undefined(그 낱장을 그리지 않는다)
 */
export function renderCoverSlots(input: CoverSlotInput): CoverSlots {
  if (input.notice) return { coverPage: <PaperCoverNotice message={input.notice} /> };
  const { cover, images = {} } = input;
  if (!cover) return {};
  const title = coverTitleFor(cover, input.paperTitle, input.suffix);
  return {
    coverPage: (
      <PaperCoverPage
        cover={cover} title={title} imageUrl={images.frontUrl} imageFailed={images.frontBroken}
        year={input.year} teacher={input.teacher}
      />
    ),
    backCoverPage: cover.backKind === 'none' ? undefined : (
      <PaperBackCoverPage
        cover={cover} title={title} imageUrl={images.backUrl} imageFailed={images.backBroken} year={input.year}
      />
    ),
  };
}
