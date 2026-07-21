# p3-sound
effort: high
high_risk: 0

## Goal
사운드: 상호작용 SFX + 잔잔한 앰비언스 (기본 음소거 토글)

## Why
아이 흥미 — 무음 게임은 밋밋하다. 파도·새 앰비언스와 탭 이동·편지 열기·조각 놓기·등대 점등 효과음이 몰입과 재방문 욕구를 크게 올린다.

## Do
새 오디오 모듈 + HUD 큰 스피커 토글. 첫 사용자 제스처 후에만 재생, reduced-motion·음소거 존중. public/island/audio/LICENSE.md에 출처 기록(무료 티어=비상업 → 실배포 전 유료 교체 규칙 준수). island-state 불변.

## Scope
- src/components/island/island-audio.ts
- public/island/audio/LICENSE.md

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
