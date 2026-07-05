# review: t6-landing
decision: approve (attempt 4)
date: 2026-07-06

## 최종 상태
- W1 실문구: 헤드라인 정확·신뢰 칩 3·리포트 실물 슬롯(정직한 플레이스홀더+/sample/report 링크)·ks 조건부 ₩19,000 배지(P-1, searchParams 서버 판정).
- **주 CTA = `/auth/login?next=/onboarding` "우리 아이 이야기 시작하기"** — 전환 설계 원칙 1(체험→가치→결제) 준수, Toss/BIZ env와 무관하게 상시 활성. "결제 준비 중" 잠금은 W4 결제 화면(SubscribeClient — 기존 코드)에만 잔존(정위치).
- 푸터(전자상거래법 표시)·metadata는 layout.tsx 전역 유지 — 손실 없음.
- scripts/check-copy.ts 임시 금칙어 게이트 통과(E16-1이 R1 W3 정식화).

## 시도 이력 (4회 — 사유 각각 상이)
1차 scope 위반(컴포넌트 위치) → 2차 게이트 통과·리뷰에서 CTA 결함 발견 → 3차 **리드 핸드오프 파일명 실수로 회귀** → 4차 외과 수정 완료. 교훈은 RETRO·decisions.md에 기록 예정: ① 핸드오프는 반드시 `handoffs/<id>.md` 덮어쓰기 ② 사용자 대면 화면은 게이트 통과와 별개로 여정(퍼널) 정합을 리뷰 렌즈에 명시.
