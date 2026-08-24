/**
 * 리퀴드 글라스 디자인 정본 (docs/plan/09 §5) — 랜딩에서 확립한 표면 언어를 전 제품에 통일.
 * 백드롭 블러 + 채도 부스트, 상단 1px 스펙큘러 하이라이트. 명(크림 위)/암(이미지 위) 2벌.
 * 페이지별 재정의 금지 — 반드시 이 모듈에서 import 한다.
 */

/** 밝은 배경(크림) 위 유리 카드. */
export const GLASS_LIGHT =
  'rounded-3xl border border-white/60 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_32px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150';

/** 어두운 배경(이미지·영상) 위 유리 카드. */
export const GLASS_DARK =
  'rounded-3xl border border-white/20 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150';

/** 유리 필(pill) — 스티키 네비 등 소형 표면. */
export const GLASS_PILL =
  'rounded-full border border-white/50 bg-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_rgba(35,49,38,0.10)] backdrop-blur-2xl backdrop-saturate-150';

/** 주 CTA 버튼(잉크 바탕) — 샤인 스윕은 group 클래스와 함께 쓸 것. */
export const BUTTON_PRIMARY =
  'inline-flex min-h-14 items-center justify-center rounded-full bg-ink px-8 text-base font-bold text-cream transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100';
