# t8-water-key
effort: medium
high_risk: 0

## Goal
통합 드리프트 수정: map.ts와 props.ts가 텍스처 키 'island-water-pack'을 서로 다른 방식
(일반 이미지 vs 아틀라스)으로 등록해, props.ts의 물거품 스프라이트가 참조하는 명명 프레임
(`water-tile__r005_c000..002`)이 런타임에 없다(Phaser "has no frame" 경고, wave hygiene에서 발견).

## Do
- src/components/island/props.ts의 WATER_ATLAS 키 값을 map.ts와 충돌하지 않는 고유 키로
  변경(예: 'island-water-props'). props.ts는 자기 아틀라스를 실제로 로드하게 된다.
- 같은 파일 안에서 해당 키를 참조하는 모든 지점(atlasesReady, drawWaveFoam의 anims/sprite)
  일관 변경.
- 다른 모듈의 텍스처 키와 추가 충돌이 없는지 grep으로 확인만(변경 금지):
  map.ts('island-terrain-pack','island-water-pack','island-scenery-pack'),
  npc.ts('island-character-sheet'), props.ts('island-props-pack').
- 검증 후 프로덕션 빌드에서 /island 로드 시 위 Phaser 프레임 경고가 사라져야 한다.

## Scope
- src/components/island/props.ts

## Constraints
- 키 문자열 변경 외 로직 변경 금지. map.ts·engine.ts·npc.ts·IslandClient.tsx 수정 금지.

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```
