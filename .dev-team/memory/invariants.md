# Invariants — 위반 시 리뷰 반려 (codex-worker 시절부터 누적)

1. **대표 3기준 최우선**: ① 애플급 미니멀(한 화면 한 행동) ② 보이지 않는 AI(고객 표면 AI 언급 금지 — LibraryPlayer 법정 라벨 1곳 제외) ③ 쓸수록 초개인화.
2. **정본 문서**: C6 v1.0 = `.dev-team/memory/c6-spec-v1.md` · 애니메이터 스튜디오 = `.dev-team/memory/studio-reference.md` (레퍼런스 탈락 이력 포함 — VEED가 최종, Kling/Seedance 립싱크 재실험 금지).
3. **용어 가드레일**(docs/00_HANDOFF.md §4): 고객 화면 문자열에 진단/평가/점수/등급/또래비교/부족/발달지연/C코드/커리큘럼 금지. 내부 코드·주석은 허용.
4. **아이 화면**: 글보다 이미지·음성, 터치 ≥48px, 오답·위협·재촉 없음. playsInline 제거 금지.
5. **점수 서버 전용**: axis level/confidence 숫자를 API 응답·클라이언트에 노출 금지(성장 문구/stage로 변환).
6. **금지 관행**: main 푸시(DRAFT PR만), 시크릿 커밋/로그, RLS 약화, supabase/manual/ SQL을 migrations로 복귀, NEXT_PUBLIC의 process.env 동적 조회(인라인 안 됨).
7. **머니코드·인증**(subscription/billing/renewal/auth)은 명시 미션이 아니면 Scope 금지. 고위험(결제·마이그레이션)은 preflight + 단독 실행.
8. **기존 계약 확장만**: /api/game/events 저장 계약, game_rounds 스키마, published=false HITL 게이트 파괴 금지.
9. **검증 표준**: lint+tsc 전 태스크, UI는 build, 순수 로직은 node:test(`npx tsx --test`, 상대 import). Validation에 키/.env/db push 금지 — 실생성·실DB는 사람 게이트.
10. Next.js 16 — 코드 전 node_modules/next/dist/docs/ 확인 (error.tsx=unstable_retry 등).
11. **플랜 정본 읽기 전용**: `docs/plan/00~05`는 SSOT — 워커 수정 금지, 개정은 리드만. 스키마·SQL은 02 문서에서 **그대로 전사**(재발명 = 반려).
12. **D-14(2026-07-05)**: 아이 표면 = 웹 선행(R1–R2), iOS(kindy-app)는 R3~R4 이식. 아이 표면 신규 화면 터치 타깃 ≥120pt(기획서 v2.2 §5 — 구 48px 기준을 아이 표면에서 대체), 부모 웹 ≥44pt.
13. **prod 조작 [사람] 전용**: supabase db push·link, Secret Manager, Inngest Cloud, Toss, gcloud, gh 원격 설정 변경 — 워커 실행 금지(04 §0).
14. **원본 문서 보관**: `docs/research/original/`은 수령 원본 사본 — 수정·삭제 금지.

## 이용자 불변 조항 (2026-07-20 대표 지시)
- **타겟 = 7~10세 초등 저학년. 게임이 어려우면 안 된다.** 모든 게임 태스크에 적용:
  조작은 탭 이동 하나 / 실패·사망·전투 없음 / 길이 목적지로 시각 유도(길찾기 퍼즐 금지) /
  텍스트 최소·큰 글씨 / 탭 타깃 44px+ / Enemies류 에셋 사용 금지.
- 에셋 라이선스: Cute Fantasy 무료 티어 = 비상업 전용 → 개발·시안 한정. 실배포 전 유료 교체 필수(LICENSE.md 참조).
