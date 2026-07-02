# Handoff: demo-funnel-c6 (attempt 1 → retry 필요)

## 이전 런 요약
구현 자체는 하드 게이트 전부 통과(금지어 0, 익명성, 재사용 규율, 퍼널 무결성, 빌드 그린). 리뷰 결정: request_changes.

## 반려 사유 (크리티컬 1)
첫 관찰 카드가 모든 사용자에게 바이트 단위 동일:
- 세 선택 슬롯의 축이 고정(emotion→C6, clue→C2|C3, creative→C5) + 각 1표씩 → 최빈 축 없음 → `pickStrengthAxis` 동점 시 first-seen → **강점 항상 C6**.
- `pickGrowthAxis`가 C6_AXIS_IDS 순서 첫 미선택 축 → C1은 데모에 아예 등장하지 않아 **자랄 씨앗 항상 C1**.
- 카피("아이가 고른 씨앗")와 모순 — SNS 퍼널 최상단에서 신뢰 훼손.

## 오케스트레이터 결정 (택1 중 a 확정)
카드가 실제 선택에 반응해야 한다. canned 카드 + 카피 완화(b)는 대표 3기준(초개인화) 위배로 기각.

## should_fix (같이 처리)
- creative 선택이 마지막 프레임(≈14.95s)에 뜸 — creative 씬 endSec를 앞당겨 선택 전 시각 맥락 제공.
- `mori-demo-ending`(14.9–15) 빈 0.1s 플래시 씬 제거 — 최종 선택 후 바로 completeOnce.

## 유지할 것 (재작업 금지)
쿠키 스키마·파서(demo-observation.ts), redirect, 링크 갱신, 금지어 0 상태, InteractiveVideoPlayer 재사용 방식, 한 화면 한 행동 레이아웃.
