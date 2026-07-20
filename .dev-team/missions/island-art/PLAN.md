# PLAN: island-art (2026-07-20)

한 줄 상태 — 이벤트마다 갱신. 크래시/clear 후 재진입 지점.

- t1-engine-split: merged (20eafeb) — 엔진 모듈 분리
- t2-asset-pipeline: merged (12ba333) — 아틀라스 빌드 파이프라인 + 무료 티어 산출물(2cf737a)
- t3-map-design: merged (29d8aa6) — 도달성 100% 플러드필·프레임 날조 0·계약 export 유지.
  should_fix(절벽 높이감)는 t7 이관
- t4-props-ambience: merged (022102b) — 스코프 오탐은 리드 스펙 정정, 프레임 14종 실존 대조.
  should_fix(좌표 하드코딩 중복·dedup·부유 울타리)는 t7 이관
- t5-avatar-npc: merged (cd0e7aa) — 팩 파생 characters.png(라이선스 승계 명기), 사절 NPC 렌더 확인
- t6-ui-dot: merged (498198d, attempt 2) — attempt 1 반려(스프라이트 전량 폴백) 후 재작업.
  HUD 게이지·툴바 실아이콘·NPC 카드·포커스 트랩·매핑 실존 테스트. fisherwoman·boat null 예약
- t8-water-key: merged (2a8de55) — 통합 드리프트(물 텍스처 키 충돌) 1줄 수정, Phaser 경고 0
- t7-premium-upgrade: running (xhigh 단독) — 유료 Kenmi 번들 교체(라이선스 게이트: 무료 티어는
  비상업 한정) + 아바타 파츠 + 등대 실구현·절벽·매핑 정리(이관 항목 4건 태스크에 명시)

## 메모
- 2026-07-20 오전 머신 크래시 → status.sh --recover로 t3/t4 재큐잉, t6 리뷰는 이 세션에서 수행.
- 병렬 캡 3 (BRIEF dials). 머지 3~4건마다 wave hygiene(루트에서 미션 Validation).
- 스크린샷 없이 approve 금지 (LEAD override). 프리뷰: 워크트리에서 PORT=34xx npm run start.
