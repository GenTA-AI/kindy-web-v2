# Review: t4-props-ambience (attempt 1)

decision: approve
date: 2026-07-20
gate: 1차 exit 2(스코프 오탐 — 태스크 Scope가 자체 Do와 모순, 리드가 스펙 정정) → 재게이트
validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·test 48·build)
screenshot: 워크트리 단독 빌드 확인 — 팩 나무·수풀·표류병 스파클 실렌더, 오두막·등대·부두는
카메라 프레임 밖(월드 60×80, 아바타 남측 스폰). 최종 시각 판정은 t3 머지 후 루트 통합
스크린샷에서 수행(wave hygiene).

## 판정 근거
- 프레임 키 전수 대조: props.json·water.json에 참조 키 14종 전부 실존(파이썬 대조 스크립트).
- 도트 정합: 전 좌표 col/row×TILE 정수 그리드, CATALOG_ICON_SCALE=2 정수, 오프팔레트 색
  2종(LIGHT_GLOW·CELEBRATION_FLASH 커스텀 헥스)을 팩 팔레트(PAL.Y)로 교체 — 개선.
- 카탈로그 버튼 a11y 유지: aria-label·aria-pressed·disabled 상태 확인.
- 아틀라스 비동기 로드 대기(pending* 패턴)·reduced-motion 정적 처리·SHUTDOWN 정리 양호.
- island-state.ts는 FURNITURE 아이콘 문자열만 변경(BRIEF 허용 예외), IslandClient는
  pixel-art 아이콘 → 팩 스프라이트 렌더 치환(폐기 방침 부합).

## Should fix (t7로 이관)
- CATALOG_FRAME_POSITION이 props.json의 픽셀 좌표를 하드코딩 중복 — t7 아틀라스 교체 시
  전수 갱신 필수(t7 태스크의 기존 "전수 갱신" 항목에 포함됨).
- FURNITURE_FRAME(props.ts)과 island-state FURNITURE.emoji가 같은 매핑을 이중 보유 —
  단일 소스로 dedup 권장.
- 가구·프레임 매핑 실존 검증 단위 테스트 부재 — t6 attempt 2의 매핑 테스트와 통합 예정.

## Nice to have
- 아틀라스 로드 실패 시 build() 미실행에 대한 폴백 없음(프로드에서 파일 실존 확인됨).
- 갈매기: 데코 프레임 setTintFill(WHITE) 실루엣 — 통합 화면에서 재확인.
