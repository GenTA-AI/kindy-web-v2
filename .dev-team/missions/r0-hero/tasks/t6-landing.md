# t6-landing: E12-1' 랜딩 개정 (기획서 v2.2 W1 실문구)
effort: medium

## Goal
랜딩(`src/app/page.tsx`)을 아이별 제품기획서 v2.2 §4 W1 스펙의 실문구로 개정한다: 헤드라인 **"모두에게 같은 영상이 아니라, 우리 아이에게만 맞춰 자라는 이야기."** + 리포트 실물 1장 슬롯 + 신뢰 칩 3(도서관과 함께 · 1탭 해지 · 결제 3일 전 알림) + 주 CTA 1개 + **`ks` 파라미터 존재 시에만 ₩19,000 도서관 혜택 배지**(결정 P-1 — 얼리버드는 도서관 경유 한정). 임시 카피 금칙어 검사 스크립트를 추가한다(정식 린터 E16-1은 R1 W3). 절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.5.

## Scope
- `src/app/page.tsx`
- `NEW: src/components/landing/` (랜딩 전용 분해 컴포넌트 필요 시)
- `NEW: scripts/check-copy.ts` (임시 금칙어 grep 검사)

## Constraints
- **금칙어 0**(기획서 §6 카피 사전): 로딩/추천/맞춤/분석/점수/레벨/%/오답/AI(아이 표면)/진단/평가 — 부모 표면 랜딩이지만 "점수·진단·또래비교" 계열 금지는 동일. 대체어 사전을 따르라.
- 다크패턴 금지: 카운트다운·강제 팝업·거짓 희소성 금지. 신뢰 칩은 사실만(1탭 해지·D-3 알림은 실제 구현 존재 — 0017·subscription-renewal.ts).
- `ks` 어트리뷰션은 기존 로직(`src/app/start/`·`src/lib/attribution.ts`·`kioskTrack.ts`) **읽기 재사용만** — 수정 금지.
- 리포트 실물 1장은 `/sample/report` 캡처 또는 기존 샘플 자산 경로를 쓰되, 실물 이미지가 없으면 슬롯 컴포넌트+플레이스홀더 명시(가짜 리포트 이미지 생성 금지 — 실물 원칙).
- 결제 CTA 잠금 동작(NEXT_PUBLIC_TOSS_CLIENT_KEY 부재 시 "결제 준비 중") 보존.
- `scripts/check-copy.ts`: src/app/page.tsx(+landing 컴포넌트)의 문자열에서 금칙어를 검사, 발견 시 exit 1 + 위치 출력. 04 Task 2.5 각주대로 "임시 — E16-1이 정식화" 주석.
- worktree에 node_modules가 없으면 먼저 `npm ci`.

## Deliverables
- 개정된 랜딩(헤드라인·칩 3·CTA 1·ks 조건부 배지) — 데스크톱/모바일 기본 반응형 유지
- scripts/check-copy.ts 통과 상태

## Validation
```bash
grep -q "모두에게 같은 영상이 아니라" src/app/page.tsx src/components/landing/*.tsx 2>/dev/null && echo headline-ok
grep -rq "결제 3일 전" src/app/page.tsx src/components/landing/ 2>/dev/null && echo chip-ok
grep -rq "19,000" src/app/page.tsx src/components/landing/ 2>/dev/null && echo badge-ok
npx tsx scripts/check-copy.ts
npm run lint
npx tsc --noEmit
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 ks 배지의 노출 조건 구현 방식(서버/클라이언트)과 리포트 실물 슬롯 처리 방식.
