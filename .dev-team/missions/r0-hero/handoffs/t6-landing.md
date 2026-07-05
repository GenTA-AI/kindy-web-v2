# handoff: t6-landing (attempt 3 → 4) — CTA 라우팅 결함 1건만 수정

## 경위 (리드 과실 공지)
attempt 3은 리드의 핸드오프 파일명 실수로 구버전 지시를 받아 태스크를 재수행했다. 현재 worktree 상태(attempt 3 산출물)는 게이트 통과 상태이며 **구조는 그대로 두고 아래 1건만 고친다.**

## 유일한 결함 (리뷰 request_changes — 두 번째 재지적)
`src/app/page.tsx`의 주 CTA가 `href="/subscribe"`("멤버십 시작하기")이고, 결제 키 부재 시 "결제 준비 중"으로 잠긴다.
- 위반: 전환 설계 원칙 1 — "체험→가치 확인→결제 절대 준수, 무료 3세션 카드 선등록 금지"(사업재무 마스터플랜 §2.2) + 기획서 여정(랜딩→온보딩→체험→첫 리포트→결제).
- 결과: 결제 키 없으면 무료 체험 퍼널 전체 차단.

## 고칠 것 (이것만 — 다른 파일·구조 변경 절대 금지)
1. 주 CTA를 `href="/auth/login?next=/onboarding"`으로 교체(구 랜딩 START_HREF와 동일 — 기존 auth 플로우 재사용).
2. 라벨을 여정 언어로 교체 — "우리 아이 이야기 시작하기" (금칙어 0, 기획서 §6).
3. **"결제 준비 중" 잠금 분기를 주 CTA에서 완전 제거**(체험은 결제와 무관 — Toss/BIZ env와 무관하게 항상 활성).

## 검증
태스크 파일 Validation 블록 전체 재실행 + `npx tsx scripts/check-copy.ts` 통과 유지. worktree에 node_modules 있음.
