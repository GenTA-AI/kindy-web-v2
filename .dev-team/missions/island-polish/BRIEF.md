# Mission brief: island-polish
date: 2026-07-21
domain: uiux (아동 게임 폴리싱)

## What we're building
등대섬 도트 게임(/island)을 폴리싱해 ① 아이들이 좋아하고 ② 초등 저학년(7~10세)도 헤매지 않고 잘
하도록. island-art 아트 리워크 이후 후속(RETRO 후속 항목 포함). 조작감·안내·보상 연출·사운드·읽기
보조·접근성을 손보되, 게임의 핵심 루프(표류병→수업→조각→꾸미기)와 상태 로직은 불변.

## Success criteria
- 아이가 처음 켜서 설명 없이 바로 논다(손가락 힌트·길 유도)
- 탭이 먹혔는지/왜 안 가는지 즉시 안다(도착 링·막힌 탭 바운스)
- 편지 열기·조각 배치·등대 점등이 '보상'으로 느껴진다(연출)
- 파도·새 앰비언스 + 상호작용 효과음(음소거 토글)
- 글 못 읽는 저학년도 편지·안내를 소리로 듣는다(들어보기 버튼, 사전 녹음)
- 낚시 여인 소품 복원 등 첫인상 생동감

## Mission validation
```bash
npm run lint
npx tsc --noEmit
npm run test
npm run build
```

## Boundaries (out of scope / do not touch)
- src/lib/island/island-state.ts 로직 변경 금지(조각 경제·스키마). #9(관용적 꾸미기)만 예외로 리드
  승인 하에 별도 스코프 — 그 외 태스크는 연출·안내·오디오·DOM 계층으로 로직 불변.
- /lesson, /world, 랜딩, 결제, 부모 대시보드 코드 금지
- 새 npm 의존성 금지(phaser 기설치분만)

## Minefields (island-art RETRO 컴파운드)
- **아틀라스 JSON이 진실**: 새 프레임/에셋 키는 public/island/tiles/*.json(또는 audio LICENSE) 실키만
  상수화 + 실존 assert 테스트. 지어내기 금지.
- **Phaser 텍스처/오디오 키는 전 모듈 공유 네임스페이스**: 모듈 접미사로 구분(통합 드리프트 방지).
  워크트리 통과 ≠ 통합 통과 — 머지 후 실화면 확인.
- **이동 불변식**: engine.test 400회 무작위 탭 "종료 위치=보행 칸" 유지. 이동 로직 수정 시 이 테스트 유지.
- Phaser SSR 불가 — IslandView dynamic(ssr:false) 경계 유지. Strict Mode 이중 마운트 멱등.
- 새 오디오/이미지 에셋: docs/ASSETS.md + LICENSE.md 장부 갱신. **무료 티어=비상업 한정 → 실배포 전
  유료 교체 필수**(신규 사용 시 명기).

## 이용자 불변 조항 (7~10세, 절대 위반 금지)
탭 이동 하나 조작 유지. 실패·사망·전투·적·경고음·붉은 오류 없음. 재촉·위협 없음. 길은 목적지로 시각
유도(길찾기 퍼즐 금지). 아이 표면 신규 요소 터치 타깃 ≥120pt 지향(불변조항 12). 텍스트 라벨은 아이콘
병기·의미는 aria-label 보존. 라이브 TTS 등 고객 표면 AI 언급 금지(사전 녹음만).

## Dials
- default effort: high
- parallel cap: 3
- merge mode: merge
