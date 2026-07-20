# PLAN: island-art (2026-07-20)

한 줄 상태 — 이벤트마다 갱신. 크래시/clear 후 재진입 지점.

- t1-engine-split: merged (20eafeb) — 엔진 모듈 분리
- t2-asset-pipeline: merged (12ba333) — 아틀라스 빌드 파이프라인 + 무료 티어 산출물(2cf737a)
- t3-map-design: done·게이트 통과 — 리뷰 에이전트 진행 중(계약 export·충돌행렬·프레임 실존 검증)
- t4-props-ambience: merged (022102b) — 스코프 오탐은 리드 스펙 정정, 프레임 14종 실존 대조,
  단독 스크린샷 OK. should_fix(좌표 하드코딩 중복·dedup)는 t7 이관
- t5-avatar-npc: merged (cd0e7aa) — 팩 파생 characters.png(라이선스 승계 명기), 사절 NPC 렌더 확인
- t6-ui-dot: attempt 2 running (xhigh, 베이스 = t4·t5 머지 후) — 가구 아이콘은 t4로 기해결,
  HUD·카드·전환 마감 + 포커스 트랩 + 매핑 실존 테스트. fisherwoman·boat는 t7 이관(null 예약)
- t7-premium-upgrade: pending (deps: t3 t4 t5 t6) — 유료 Kenmi 번들 교체 + 아바타 파츠

## 메모
- 2026-07-20 오전 머신 크래시 → status.sh --recover로 t3/t4 재큐잉, t6 리뷰는 이 세션에서 수행.
- 병렬 캡 3 (BRIEF dials). 머지 3~4건마다 wave hygiene(루트에서 미션 Validation).
- 스크린샷 없이 approve 금지 (LEAD override). 프리뷰: 워크트리에서 PORT=34xx npm run start.
