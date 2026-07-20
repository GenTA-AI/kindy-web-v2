# Review: t8-water-key (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0

## 판정 근거
- diff 1줄: props.ts WATER_ATLAS 'island-water-pack' → 'island-water-props'. 지시 그대로,
  로직 변경 없음. t3(map.ts 이미지 키)와의 등록 방식 충돌 해소.
- 통합 검증: 머지 후 루트 빌드에서 Phaser "has no frame" 경고 소멸 확인(아래 wave hygiene).
