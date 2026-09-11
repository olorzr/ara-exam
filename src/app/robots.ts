import { MetadataRoute } from 'next';

/**
 * 이 앱은 @araeducation.co.kr 직원 전용 내부 도구다. 전체 색인을 막는다.
 *
 * 예전 주소(ara-exam.vercel.app)는 무명 도메인이라 크롤 위험이 낮았지만,
 * test.araeducation.co.kr 로 옮기면서 학원 브랜드 도메인 하위로 들어왔다 —
 * 검색 결과에 시험지·문제은행 화면이 노출될 이유가 없다.
 *
 * 접근 통제의 권위는 RLS(public.is_allowed_domain())이고 이건 색인 방지일 뿐이다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  };
}
