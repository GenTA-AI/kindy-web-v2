# Review: t7-premium-upgrade (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·테스트 50+빌더 6·--check·build)
  — 스코프 오탐 2회는 리드 정정(Do·Constraints가 전제한 파일 누락 + gate 파서가 불릿당
  경로 1개만 읽는 형식 문제. 미션 3번째 동일 패턴 → RETRO 반영)
reviewer: 리뷰 서브에이전트(5렌즈, 아틀라스 전수 파싱) + 리드 스크린샷

## 판정 근거
- 라이선스·금지(최우선): 6종 아틀라스+runtime 전체 금지 정규식 스캔 — 무기/적/전투 프레임 0건.
  원본 전부 허용 폴더 유래. fisherwoman=무기 없는 Bartender_Katy, 등대=Silo,
  신규 village-angel=무기 없는 Angel idle만 추출(금지목록 "무기 없는 스프라이트만" 부합).
  LICENSE.md = 프리미엄 상용 허용·재판매 금지·kenmi·2026-07-20 (ASSETS.md 정합).
- 프레임 정합: 이중 매핑(CATALOG_FRAME_POSITION·FURNITURE_FRAME)·부유 울타리 제거,
  runtime-atlas.json 단일 소스. 코드 참조 186 + 맵 소품 279 프레임 전부 실존(누락 0).
- 스키마: Furniture.stamp 추가만(삭제 0), 구 kindy:island 저장분 마이그레이션 불필요.
- 계약: TILE 재수출·setAvatar 배선·루프 불변·ssr:false 유지, 풀트리 tsc 통과.
- 7~10세: 전투/랭킹/타이머 0, 탭 타깃 44px+, 아바타 편집(6셔츠+2모자) 상태·접근성 완비.
- 도달성(절벽 확대 후): 2146/2146(100%), 등대 플라토 175/175, 고립 0.
- 리드 스크린샷: 유료 지형·오두막·절벽 밴드·아바타 편집기·NPC 실초상 확인. 콘솔 에러 0.

## Should fix → t10-license-guard로 이관
- build-atlas.mjs 금지 가드가 명시 sources 분기에만 적용(auto-classify 분기 무방비) +
  거부 회귀 테스트 부재. 가드 공통화 + rejection 테스트 1건.

## Nice to have (기록)
- 섬 모자 선택이 kindy:world accessory를 2값으로 덮어씀(크로스서피스 단순화 손실) — 사양대로.
- 등대=Silo가 "등대로 읽히는가" + village-angel 시각 인상은 t9(이동 버그) 수정 후
  리드 최종 스크린샷에서 확인. 미달이면 후속 폴리시 태스크(비차단).
- 낚시하는 여인이 낚싯대 없음(Characters 팩에 낚시 여성 부재) — 서사 소품(낚싯대·바위) 재부착
  후속 검토.

## 리드 처분
approve·머지. 후속: t9-move-stuck(이동 함정 버그, 실기기 QA 3지점 재현) + t10-license-guard.
등대 전경 최종 검수는 t9 후 수행.
