# Invariants

Architectural rules every worker must preserve. The reviewer diffs each run against
this file — a change that violates an invariant is grounds for `request_changes`.

1. **대표 3기준이 모든 결정에 우선**: ① 애플급 미니멀(한 화면 한 행동) ② 보이지 않는 AI(고객 표면에 AI 언급 금지 — 법정 라벨 "모리 이야기는 AI로 만들고, 사람이 한 편씩 살펴봐요" 1곳 제외) ③ 쓸수록 초개인화.
2. **C6 v1.0 정본은 `.ai/memory/c6-spec-v1.md`** — 기존 코드의 C6ToolKey(창의 6도구)와 충돌 시 정본 우선. 단, 기존 c6-profile/보호자 기록장이 깨지면 안 됨(공존 후 이관).
3. **용어 가드레일** (docs/00_HANDOFF.md §4): 고객 화면에 진단/평가/점수/등급/또래비교/부족/발달지연/C1..C6 코드/커리큘럼 금지. 내부 코드·DB·주석에는 허용.
4. **아이 화면**: 글보다 이미지·음성, 큰 터치(≥48px), 오답 개념 없음, 위협·재촉 없음.
5. **점수는 서버 전용**: axis level/confidence 숫자를 클라이언트 응답에 그대로 내보내지 않는다(성장 상태 문구/단계로 변환).
6. **금지 기술 관행**: main 푸시, 시크릿 커밋, 기존 RLS 약화, `supabase/manual/`의 SQL을 migrations로 되돌리기, process.env 동적 조회로 NEXT_PUBLIC 접근(인라인 안 됨), LibraryPlayer/InteractiveVideoPlayer의 playsInline 제거.
7. **머니코드**(subscription/billing/renewal)와 인증 경로는 이번 작업 범위 밖 — Scope에 넣지 말 것.
8. **검증**: 모든 패키지는 `npm run lint && npx tsc --noEmit`을 Validation에 포함. UI 패키지는 `npm run build`도.
9. Next.js 16 — 코드 전 node_modules/next/dist/docs/ 해당 가이드 확인 (error.tsx는 unstable_retry, NEXT_PUBLIC 인라인 규칙 등).
10. 기존 `game_rounds` 저장 계약(/api/game/events)은 확장만 허용, 파괴적 변경 금지 — 보호자 기록장이 소비 중.
