# p5-read-aloud
effort: high
high_risk: 0

## Goal
음성 읽어주기 (저학년 읽기 보조)

## Why
저학년 접근성 — 아직 글을 못 읽는 7~8세를 위해 편지·안내 문구를 소리로 들려준다. 게임의 유일한 텍스트 장벽을 제거.

## Do
NPC 편지 카드와 꾸미기 안내에 큰 '들어보기' 스피커 버튼(사전 녹음 오디오 에셋). 라이브 TTS 금지(보이지 않는 AI 원칙 — 고객 표면 AI 언급 없음). 버튼은 아이콘, 타깃 규격 준수.

## Scope
- src/components/island/npc.ts
- public/island/audio/LICENSE.md
- src/components/island/IslandClient.tsx
- src/components/island/island-audio.ts
- src/components/island/engine.test.ts
- docs/ASSETS.md
- public/island/audio/decorate-guide-ko.mp3
- public/island/audio/npc-letter-ko.mp3

## Constraints
- island-state.ts 로직·스키마 불변(연출·안내·오디오·DOM 계층으로만).
- 이용자 불변조항: 탭 이동 하나·실패/경고음/붉은오류 없음·재촉 없음·큰 타깃(≥120pt 지향)·라이브 TTS 금지.
- 새 프레임/오디오 키는 실키만 + 실존 assert 테스트. Phaser 키는 모듈 접미사. engine.test 이동 불변식 유지.
- reduced-motion·음소거 존중. 새 에셋은 docs/ASSETS.md·LICENSE.md 장부 갱신(무료 티어 비상업 명기).

## Validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```
