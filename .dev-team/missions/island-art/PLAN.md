# PLAN: island-art (2026-07-20)

한 줄 상태 — 이벤트마다 갱신. 크래시/clear 후 재진입 지점.

- t1-engine-split: merged (20eafeb) — 엔진 모듈 분리
- t2-asset-pipeline: merged (12ba333) — 아틀라스 빌드 파이프라인 + 무료 티어 산출물(2cf737a)
- t3-map-design: running (attempt 1 재디스패치 — 크래시 고아 복구, 베이스 2f06082)
- t4-props-ambience: running (attempt 1 재디스패치 — 크래시 고아 복구, 베이스 2f06082)
- t5-avatar-npc: running (attempt 1, 베이스 2f06082)
- t6-ui-dot: request_changes → attempt 2 대기 (슬롯 나는 즉시 xhigh 디스패치, handoffs/t6-ui-dot.md)
  — 가구 매핑 실프레임 고정 + 포커스 트랩 + props.png 폴백 제거 + 매핑 단위 테스트.
  fisherwoman·boat는 t7로 이관(무료 팩 부재).
- t7-premium-upgrade: pending (deps: t3 t4 t5 t6) — 유료 Kenmi 번들 교체 + 아바타 파츠

## 메모
- 2026-07-20 오전 머신 크래시 → status.sh --recover로 t3/t4 재큐잉, t6 리뷰는 이 세션에서 수행.
- 병렬 캡 3 (BRIEF dials). 머지 3~4건마다 wave hygiene(루트에서 미션 Validation).
- 스크린샷 없이 approve 금지 (LEAD override). 프리뷰: 워크트리에서 PORT=34xx npm run start.
