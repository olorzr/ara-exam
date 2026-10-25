import type { ComponentType } from 'react';
import type { PaperCoverLayout } from '@/lib/problem-paper/cover';
import type { CoverLayoutProps } from '@/lib/problem-paper/cover-text';
import BackCover from './BackCover';
import BasicCover from './BasicCover';
import EditorialCover from './EditorialCover';
import RingsCover from './RingsCover';
import SketchCover from './SketchCover';
import SoftCover from './SoftCover';
import SpinesCover from './SpinesCover';
import ZineCover from './ZineCover';

/**
 * 간단 표지 디자인 → 그리는 컴포넌트. 디자인 id·이름은 lib(`cover.ts`)에 있고 여기는 그리는 쪽만이다
 * (lib 이 컴포넌트를 import 하지 않게). `Record` 라 `COVER_LAYOUTS` 에 디자인을 더하면 여기가 빠졌을 때
 * 빌드가 깨진다. 디자인 뒷표지는 디자인 하나로 일곱 모양을 그리는 `BackCover` 다.
 */
export const COVER_LAYOUT_COMPONENTS: Record<PaperCoverLayout, ComponentType<CoverLayoutProps>> = {
  basic: BasicCover,
  editorial: EditorialCover,
  rings: RingsCover,
  spines: SpinesCover,
  soft: SoftCover,
  sketch: SketchCover,
  zine: ZineCover,
};

export { BackCover, BasicCover, EditorialCover, RingsCover, SketchCover, SoftCover, SpinesCover, ZineCover };
