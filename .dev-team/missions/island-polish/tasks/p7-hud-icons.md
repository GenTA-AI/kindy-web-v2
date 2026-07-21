# p7-hud-icons
effort: high
high_risk: 0

## Goal
HUD 아이콘화 + 핵심 타깃 확대 (글 대신 그림)

## Why
저학년 접근성 — '꾸미기/완료/옷 오류/옷 준비 중' 텍스트 라벨을 아이콘 병기로 바꾸고 핵심 액션 타깃을 키운다(아이 화면 큰 타깃 원칙).

## Do
IslandClient.tsx 헤더 버튼·툴바 메시지. 시각 라벨은 아이콘, 의미는 aria-label로 보존. 아이 표면 신규 요소 터치 타깃 상향(불변조항 12: ≥120pt 지향). 용어 가드레일 준수.

## Scope
- src/components/island/IslandClient.tsx

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
