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

## island-art 미션 컴파운드 (2026-07-20 리트로)
15. **아틀라스 JSON이 진실**: 프레임 키를 코드에서 지어내지 말 것 — public/island/tiles/*.json
    (또는 runtime-atlas.json)에서 확인한 실키만 상수화. 새 프레임 참조에는 실존 assert
    단위 테스트 필수(island-state.test.ts·engine.test.ts 패턴).
16. **태스크 Scope는 Do·Constraints가 전제한 파일 전부 명시**: 이번 미션 스코프 게이트 오탐
    3회 전부 리드 스펙 버그. gate.sh는 불릿당 경로 1개(첫 토큰)만 읽는다 — 쉼표 병기 금지,
    주석은 경로 뒤 공백 이후로.
17. **Phaser 텍스처 키는 전 모듈 공유 네임스페이스**: 같은 키를 이미지/아틀라스 다른 방식으로
    이중 등록하면 통합에서만 깨진다(t8 사례). 키는 모듈 접미사로 구분(island-water-props 등).
    워크트리 검증 통과 ≠ 통합 통과 — 머지 후 wave hygiene(루트 실행·실화면)은 생략 불가.
18. **이동 불변식**: 아바타 이동 종료 위치는 항상 보행 가능 칸(경계 0.51px 인셋)·비보행 시작
    탈출 허용 — engine.test.ts 400회 무작위 탭 테스트가 감시. 이동 로직 수정 시 이 테스트 유지.
19. **에셋 라이선스 게이트**: 아동용 금지 에셋(Enemies/Goblins/무기/Military) 차단은
    build-atlas.mjs 공통 경로 + 거부 테스트로 강제(t10). 신규 팩 추가 시 docs/ASSETS.md
    장부 갱신 + LICENSE.md 산출 확인이 머지 조건.

## presale-lockdown 미션 (2026-08-03) — 머니·RLS 불변 조항
20. **앱 레이어 강제는 강제가 아니다.** 브라우저는 anon 키로 PostgREST에 직접 갈 수 있다.
    권한·결제·페이월·체험 한도는 **DB 정책**이 막아야 한다. "API 라우트에서 확인함"은 근거가 아니다.
21. **머니 판정의 신뢰 원천**: 청구·엔타이틀먼트 결정이 사용자가 쓸 수 있는 테이블 값에 의존하면
    반려. 신뢰 원천은 프로바이더 응답 또는 service-role 전용 행뿐. (2026-08-03 사고: `purchases.status`를
    사용자가 'paid'로 UPDATE → 카드 청구 없이 구독 활성화.)
22. **RLS 정책 신규 추가 시 `to authenticated` DML 금지.** owner-scoped SELECT만.
    컨벤션 원본 = `0024_hero_world_state.sql`~`0029_hero_metrics.sql`. 기존 마이그레이션 수정 금지,
    새 번호로만 추가.
23. **RLS 검증은 인증 세션으로 쓰기를 시도해야 한다.** anon/service-role SELECT 카운트만 세는 검사는
    2026-08-03에 발견된 결함 4건을 전부 못 잡았다(0029까지 생존). `scripts/verify-rls.ts`의
    authenticated 쓰기 매트릭스를 지우거나 우회하지 말 것. PostgREST의 2xx/204는 성공 증거가 아니다 —
    **전후 값 스냅샷으로 불변을 확인**해야 한다.
24. **프로덕션 우회 플래그 금지**: `KINDY_LOCAL_PREVIEW=1`·`LESSON_GUEST_MODE=1`이 프로덕션에서
    켜지면 부팅이 실패해야 한다. 특히 전자는 빌링키를 평문 저장시킨다.
