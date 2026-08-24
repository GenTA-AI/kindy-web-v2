# p4-onboarding
effort: medium
high_risk: 0

## Goal
첫 방문 온보딩 (말없는 손가락 탭 힌트)

## Why
저학년 접근성 — 설명 글 없이 조작을 즉시 이해시킨다. 최소 글씨·아이콘으로 '탭 이동 하나' 원칙을 시연.

## Do
IslandClient.tsx: 첫 로드 시 아바타→표류병 방향으로 움직이는 손가락 아이콘 + '톡!' 한 마디, 첫 탭에 사라짐. 별도 localStorage 키(kindy:island-onboarded) 사용 — island-state normalize/스키마 불변.

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
