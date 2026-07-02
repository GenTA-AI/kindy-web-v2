# Package: demo-funnel-c6

## Objective
SNS 데모 퍼널 개편: `/demo/ai-diagnosis`(질문지형)를 익명 미니 여행 `/demo/mori`로 교체한다 — 기존 데모 영상 안에서 선택 2~3개(InteractiveVideoPlayer 재사용) → 쿠키에 익명 관찰 → "첫 관찰 카드"(강점 씨앗 1 + 더 자랄 씨앗 1 + "하루 15분" 제안) → `/start` CTA. 로그인·DB 없이 동작하고, 금지어 0.

## Scope
- NEW: src/app/demo/mori/page.tsx
- NEW: src/app/demo/mori/MoriDemoJourney.tsx
- NEW: src/data/demo/mori-demo-graph.ts
- NEW: src/lib/demo-observation.ts
- `src/app/demo/ai-diagnosis/page.tsx` (서버 redirect로 축소)
- `src/app/demo/ai-diagnosis/AiDiagnosisDemo.tsx` (삭제)
- `src/app/demo/page.tsx` (링크 1곳 `/demo/ai-diagnosis` → `/demo/mori`)
- `src/app/page.tsx` (11행 `DEMO_HREF` 상수만 `/demo/mori`로)
- 읽기 전용 재사용: `src/components/game/InteractiveVideoPlayer.tsx` `src/types/interactive-session.ts` `src/lib/c6/axes.ts` `src/components/MoriCharacter.tsx`

## Constraints
- **익명**: 로그인·supabase·/api 호출 없음. 선택 결과는 클라이언트 쿠키 `kindy_demo_observation`(JSON `{ v:1, choices:[{choiceId,optionId,axisId}], strength_axis, growth_axis, created_at }`, max-age 30일, SameSite=Lax, PII 없음)에만 저장. 파서/시리얼라이저는 `src/lib/demo-observation.ts`에 export(가입 후 이관은 이 쿠키를 읽는 후속 작업 몫 — 이 패키지는 쓰기만).
- **미니 여행 그래프**: 번들 자산 `/demo-videos/mori-starlight-seed.mp4` + `.vtt` + 포스터 `/ip/generated/mori-village-hero.png`를 startSec/endSec로 잘라 씬 분할(ANIMAL_VILLAGE_SCENE_GRAPH의 0–4.8/4.8–7.2/7.2–11.4/11.4–15 패턴 참고). 단 **animal-village.ts는 수정·import하지 않는다**(데모 전용 그래프 신설). 선택 2~3개: emotion 1(→C6_social_emotional), clue 1(옵션별 C2/C3), creative 1(→C5). ChoiceOption→axis 매핑은 데모 그래프 옆 별도 Record로(InteractiveVideoPlayer 타입 변경 금지).
- InteractiveVideoPlayer 재사용 시 `onRoundResult`는 로컬 수집만(서버 전송 없음), `onComplete`에서 관찰 카드로 전환. **playsInline 제거 금지.**
- **첫 관찰 카드**: ① 강점 씨앗 1(선택이 가장 몰린 axis — C6_AXES child_label/parent_label + 따뜻한 한 줄) ② 더 자랄 씨앗 1(선택되지 않은 axis 중 1) ③ "하루 15분, 이야기 하나면 충분해요" 제안 ④ CTA `/start?from=ai-diagnosis`(어트리뷰션 소스 값 기존 유지) 1개 + 보조 링크 최대 1개(`/sample/report`). 막대그래프·개수 카운트·순위 목록 금지(현 데모의 "N개 단서" 바 제거).
- **금지어 0**: 진단/분석/평가/점수/등급/또래/부족/발달/AI 언급(메타데이터 title·description 포함) 금지. 카드 문구는 관찰 사실+가능성 톤("~을 먼저 살펴봤어요", "~씨앗이 더 자랄 수 있어요").
- `/demo/ai-diagnosis/page.tsx`는 `redirect('/demo/mori')`만 남긴다(next/navigation — 광고 기존 링크 보존).
- 애플급 미니멀: 한 화면 한 행동 — 진입 화면은 영상 시작 버튼 하나, 카드 화면은 CTA 하나가 시각적 주인공.
- 시크릿/.env/db push 금지. 새 의존성 금지. Next.js 16 문서(`node_modules/next/dist/docs/` — redirect, metadata) 확인.

## Deliverables
- `/demo/mori`: 영상+선택 2~3개 → 첫 관찰 카드 → /start CTA가 로그인 없이 끝까지 동작.
- 선택 완료 시 `kindy_demo_observation` 쿠키 기록.
- `/demo/ai-diagnosis` 접속 시 `/demo/mori`로 redirect, 랜딩·데모 목록 링크 갱신, 구 컴포넌트 삭제.
- 고객 표면(새 데모 전체)에 금지어·숫자 지표 0.

## Validation
```bash
npm run lint && npx tsc --noEmit && npm run build
```

## Handoff requirements
Return:
- summary
- changed files
- validation result
- known risks
- HUMAN 단계: SNS 광고 랜딩 URL을 `/demo/mori`로 갱신할지(redirect가 있으니 선택), 모바일 사파리 실기기 재생 QA.
