# t2-asset-pipeline
effort: high
high_risk: 0

## Goal
구매한 프로 픽셀 팩(원본 zip: assets-inbox/ 안의 파일)을 게임이 쓰는 규격으로 가공하는 파이프라인.

## Do
- assets-inbox/ 의 팩 압축을 풀어 분석 → public/island/tiles/에 용도별 아틀라스(PNG+JSON: terrain / water / props / character)로 재단하는 스크립트 scripts/island/build-atlas.mjs (sharp 사용).
- 타일 16px 그리드 검증(어긋나면 실패). 팩의 애니 프레임(물·풀 흔들림 등) 시트 규격화.
- public/island/tiles/LICENSE.md에 팩 이름·구매처·라이선스 조건·구매일 기록.
- 팩 파일이 아직 없으면: 스크립트+문서를 완성하고 assets-inbox/README.md에 투입 방법을 남긴 뒤 정상 종료(검증은 스크립트 유닛 수준).

## Scope
- scripts/island/
- public/island/tiles/
- assets-inbox/README.md

## Constraints
- src/components/island/ 수정 금지

## Validation
```bash
npm run lint
npx tsc --noEmit
node scripts/island/build-atlas.mjs --check || true
npm run test
```
