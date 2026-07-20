# Review: t3-map-design (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·test 48·build)
reviewer: 리뷰 서브에이전트(4렌즈) + 리드 워크트리 스크린샷

## 판정 근거 (리뷰 에이전트 검증)
- 프레임 정합: terrain(8×8)·water(5×4)·props 아틀라스 실파싱 대조 — map-data.ts의 전 인덱스와
  props 프레임 키 51종 실존, 날조 키 0. pixel-art.ts 신규 사용 0(폐기 방향).
- 충돌 무결성: map-data.ts 실행 플러드필 — AVATAR_START에서 걷기 가능 2194/2194(100%) 도달,
  고립 구역 0. 모래톱·꾸미기 밭(남측 울타리 gap 진입)·부두·등대 플라토(231/231)·서쪽 숲 전부 도달.
- 계약 안정성: engine/props/island-game이 map에서 import하는 심볼 전부 유지·시그니처 호환.
  t4 props.ts와 루트 충돌 없음.
- 경계: map.ts+map-data.ts만 수정. 새 의존성·Enemies·랭킹/타이머/전투 0.
- 리드 스크린샷: 곡선 해안선·바다 타일·갈림길 유도·부두 — 상용 픽셀아트 첫인상 충족, 콘솔 에러 0.

## Should fix (비차단 — 미관)
- 등대 곶이 "솟은 절벽"이 아니라 잔디 위 얇은 어두운 윤곽으로 읽힘(isCliffAt이 가장자리만
  절벽 타일). 절벽 밴드 두껍게/플라토 정상 타일 분리/바다면 절벽 추가로 높이감 부여 가능.
  → t7(아틀라스 교체 시 지형 전수 갱신)에서 함께 처리하거나 통합 스크린샷 후 폴리시 태스크로.

## Nice to have
- 첫 로드 시 WORLD_BACKGROUND 1프레임 노출 가능(onReady 동기 호출 vs 비동기 로드 — engine 범위 밖).
- 물 바탕 60×80 전면 드로 중복(무해), ripples 3프레임 중 2위상만 사용, footprint* 네이밍 오해 소지.
