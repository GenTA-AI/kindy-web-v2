# handoff: t6-landing (attempt 2 → 3) — 리뷰 request_changes 1건, 외과 수정만

## 게이트/리뷰 상태
gate 통과(validation_exit=0, scope_ok=1). 콘텐츠 리뷰에서 **주 CTA 라우팅 결함 1건** — 나머지(헤드라인·칩 3·ks 배지·리포트 슬롯·check-copy)는 승인 상태이므로 절대 건드리지 마라.

## 결함
`src/components/landing/LandingCta.tsx`가 주 CTA를 `/subscribe`로 보내고, `NEXT_PUBLIC_TOSS_CLIENT_KEY`·사업자정보 부재 시 CTA 전체를 "결제 준비 중"으로 잠근다.
- 위반: 전환 설계 원칙 1 "체험→가치 확인→결제 절대 준수, 무료 3세션 카드 선등록 금지"(사업재무 마스터플랜 §2.2 — docs/research/original/문서세트_2026-07-05_현행정본/Kindy_사업재무_마스터플랜_v1.0.md) + 기획서 여정(랜딩→온보딩 5단계→체험→첫 리포트→결제).
- 결과: 결제 키 없으면 무료 체험 퍼널까지 차단됨(W3 온보딩 완료율 실측 불가).

## 고칠 것 (이것만)
1. 주 CTA: `href="/auth/login?next=/onboarding"`(구 랜딩 START_HREF와 동일 — 기존 auth 플로우 재사용), 라벨은 여정 언어로 — 예: "우리 아이 이야기 시작하기"(금칙어 없음, 기획서 §6 준수). **Toss/BIZ 잠금 로직을 주 CTA에서 제거**(체험은 결제 무관).
2. "결제 준비 중" 잠금은 삭제하거나, 쓰려면 /subscribe 관련 보조 표면에만(랜딩 주 CTA에는 금지). 가장 단순한 답 = LandingCta에서 checkoutReady 분기 전체 제거.
3. Validation 블록 전체 재실행 + `npx tsx scripts/check-copy.ts` 통과 유지.

## 주의
- page.tsx·다른 컴포넌트·check-copy.ts 수정 금지(승인된 상태 보존). worktree에 node_modules 있음.
