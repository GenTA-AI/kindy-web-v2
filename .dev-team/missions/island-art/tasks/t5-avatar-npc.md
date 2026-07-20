# t5-avatar-npc
effort: high
high_risk: 0

## Goal
팩 스타일과 한 세계로 보이는 아바타·NPC.

## Do
- npc.ts + engine의 아바타 로더: 팩 캐릭터 시트 기반 4방향 워크(idle 포함), 팔레트 스왑으로 kindy:world 몸색 반영(팩 캐릭터의 옷/머리 영역 팔레트 치환 — setTint 곱연산 금지, 픽셀 팔레트 매핑으로).
- NPC '낚시하는 여인'(그림 섬 사절): 해변 바위에 낚싯대 든 모습, idle 애니, 접근 시 말풍선 아이콘.
- 표류병 NPC 카드 트리거와 연결(기존 이벤트 인터페이스 유지).

## Scope
- src/components/island/npc.ts
- public/island/avatar/
- src/components/island/engine.ts

## Constraints
- engine.ts는 아바타 텍스처 키 참조부만(3줄 이내, 주석 명시), map.ts·props.ts·IslandClient.tsx 수정 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
```
