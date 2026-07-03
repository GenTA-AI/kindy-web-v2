# Decisions (누적)

- 2026-07-02: codex-worker(.ai/) → dev-team(.dev-team/) 하네스 전환. .ai/는 레거시 보존(패키지·리뷰·정본 이력) — 두 하네스 혼용 금지.
- 2026-07-02: 애니메이터 스튜디오 완성(1685415~9c43112) — 원커맨드 러너 scripts/animate-episode.ts. 대표 키 게이트 대기(FAL/GOOGLE/ANTHROPIC → 1편 실생성 ~$1.3 검수).
- 2026-07-02: C6 v1.0 8패키지 완성(6c67a45~df34417). 사람 게이트: 0023 db push, story_seeds HITL, iPad QA.
- 러너 insert 멱등성+0021 프리플라이트 이관 = 다음 사이클 should_fix.
- 테스트 러너 = node:test + npx tsx --test(상대 import). /demo/mori가 데모 정본(ai-diagnosis는 redirect).
- 2026-07-03: **브랜드 룩 확정 = 3D 소프트매트 토이** (대표 결정). 광택 사다리 3종 비교 후 선택 — 벨벳 플로킹 질감·광택 0·눈 catchlight만·이빨 없는 미소. 글로시 비닐은 인형공포 트리거로 기각, 플러시는 취침 콘텐츠 서브 룩 후보로 보류. 2D↔3D 혼용 금지 — 랜딩·데모 룩 통일 후속 필요. 다음: 캐스트 6인 시안 → 대표 승인 → FLUX.2 LoRA 학습.
