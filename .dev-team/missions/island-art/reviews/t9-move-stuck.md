# Review: t9-move-stuck (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·테스트 55·build)
  — package.json 1줄(테스트 등록)은 리드 Scope 정정

## 판정 근거
- 설계: 1px 샘플링 폐기 → 이동 선분이 지나는 타일 경계 구간을 정밀 계산(모서리 관통 불가),
  종료 위치는 경계에서 0.51px 인셋(경계 정지·끼임 근본 차단), 비보행 시작점 탈출 허용,
  장애물 탭은 막히기 직전까지 부분 이동, 최후 안전망 nearestWalkableTileCenter.
- 테스트: 실충돌 행렬 기반 밭 울타리·절벽 케이스, 400회 고정 시드 무작위 탭("종료 위치는
  항상 보행 칸" 불변식), 트윈 중단 회귀. npm run test에 등록.
- 실기기 검증(리드): 구 빌드 영구 정지 3지점 재현 경로를 새 빌드에서 완주 — 밭 진입·탈출,
  절벽 구간 통과, 등대 플라토 도착. 스크린샷 t9-walk1~4.
- 등대 시각 판정(t7 잔여 확인 항목): 벽돌 타워+돔+랜턴, 절벽 밴드 플라토 — 등대로 읽힘. 통과.
