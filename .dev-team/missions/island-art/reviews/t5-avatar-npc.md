# Review: t5-avatar-npc (attempt 1)

decision: approve
date: 2026-07-20
gate: validation_exit=0 scope_ok=1 high_risk=0 (lint·tsc·test 48·build)
screenshot: 워크트리 단독 빌드 확인 — 낚시 사절 NPC(낚싯대·바위, idle 2프레임) 해변 표류병
우측 렌더, 아바타 팩 캐릭터 교체 확인. 콘솔 에러 0.

## 판정 근거
- 에셋 출처 적법: public/island/avatar/characters.png는 무료 팩 character.png·props.png에서만
  파생(README에 라이선스 승계 명기 — input_refs 관행 준수). 코드 생성 도트 아님.
- 팔레트 스왑: 태스크 지시대로 픽셀 단위 치환(setTint 곱연산 미사용), kindy:world
  BODY_COLORS 3단(light/base/dark) 매핑. 미지정 시 mint 폴백.
- 시트 미로드 시 registerCharacterTextures false → 기존 아바타 유지(우아한 폴백).
- 접근 반경 말풍선 + 탭 타깃 60월드px(줌2 기준 120px ≥ 44px), 기존 표류병 이벤트
  인터페이스(onBottleTap(SEURAT_BOTTLE_ID)) 유지.
- engine.ts 변경 3곳(import·preload 위임·renderNpcs 시그니처) — 제약 상한 준수.
- UPDATE 리스너 SHUTDOWN 해제, Strict Mode 안전.

## Should fix (경미 — 후속 처리)
- findAvatar가 texture key 'av-' 프리픽스 스니핑 — engine이 아바타 참조를 넘기는 명시
  인터페이스로 개선 여지(t7 아바타 파츠 v2에서 자연 해소 예상).
- FISHER_POSITION(35,62)은 t3 새 맵 기준 재확인 필요 — 통합 스크린샷에서 판정.

## Nice to have
- 사절 스프라이트는 t7 유료 Characters 팩으로 교체 예정(현행은 파생 조합, 스타일 정합 양호).
