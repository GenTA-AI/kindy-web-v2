# Package: minimal-invisible-pass--retry-1

## Objective
minimal-invisible-pass 반려 해소 1건: MoriDemoJourney.tsx의 START_HREF에서 제거된 어트리뷰션 쿼리를 원복한다. 상세: `.ai/handoffs/minimal-invisible-pass.md`.

## Scope
- `src/app/demo/mori/MoriDemoJourney.tsx` (START_HREF 상수 1곳만)

## Constraints
- START_HREF(또는 해당 CTA href)를 정확히 `/start?from=ai-diagnosis`로 되돌린다 — 이 값은 src/app/start/page.tsx의 normalizeMarketingSource·AttributionTracker(kindy_source 쿠키)·isAiDiagnosis 분기가 소비하는 고객 비가시 소스코드다.
- 다른 문자열·카피·로직·파일 일절 변경 금지.

## Deliverables
- 데모 카드 CTA가 `/start?from=ai-diagnosis`로 이동한다.

## Validation
```bash
npm run lint && npx tsc --noEmit
```

## Handoff requirements
Return: summary · changed files · validation result · known risks
