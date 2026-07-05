# handoff: t6-landing (attempt 1 → 2)

## 게이트 결과
validation_exit=0 (검증 전부 통과) / **scope_ok=0** — out-of-scope: `src/app/KsPriceBadge.tsx`

## 이전 워커가 한 것 (worktree `.dev-team/wt/t6-landing`에 그대로 있음 — 재사용하라)
- `src/app/page.tsx` 개정(539→60라인): W1 실문구 헤드라인·신뢰 칩 3·CTA 1·리포트 슬롯 — 검증 통과 상태
- `src/components/landing/` 컴포넌트들, `scripts/check-copy.ts` — 통과
- `src/app/KsPriceBadge.tsx` — **유일한 문제: 위치가 Scope 밖**

## 남은 일 (이것만)
1. `src/app/KsPriceBadge.tsx` → `src/components/landing/KsPriceBadge.tsx`로 이동(내용 유지)
2. `src/app/page.tsx`의 import 경로 갱신
3. Validation 블록 전체 재실행(태스크 파일 그대로)

## 주의
- 다른 파일 건드리지 마라. page.tsx의 대폭 축소는 리뷰에서 판단할 사안이므로 재작성 금지 — 이동·임포트 수정만.
- worktree에 이미 node_modules 있음(npm ci 불필요).
