# RETRO — island-polish (2026-08-03 종료)

## 무엇이 나갔나
등대섬 폴리싱 9개 태스크 전원 머지: p1-tap-feedback · p2-path-guidance · p3-sound ·
p4-onboarding · p5-read-aloud · p6-reward-fx · p7-hud-icons · p8-living-island · p10-a11y.
결과물은 커밋 b39d000~005a9c5 구간.

## 상태 불일치 1건 (하네스 이슈, 코드 이슈 아님)
`status.sh`가 p3-sound를 exit 143 / try3 / 1664분으로 표시하지만, 실제로는 커밋
`91c5081 devteam(island-polish): p3-sound`로 머지 완료. 세션이 죽으면서 state 파일이
merged로 전이되지 못한 고아 기록. → 교훈: 리트로 시 status.sh 단독 신뢰 금지,
`git log --oneline --grep=devteam(<slug>)`로 대조할 것.

## 워커 실수 패턴
- 스코프 게이트 오탐 3회 전부 **리드 스펙 버그**(불릿당 경로 1개만 읽힘) — invariants 16으로 이미 컴파운드됨.
- p5는 try2에서 통과: 최초 스코프가 DOM·오디오·테스트를 누락. 같은 원인.

## 리뷰 렌즈 적중
- 실화면 확인 불가(브라우저 세션 부재) 상태로 승인한 태스크가 다수 — UI 미션에서 반복되는 구조적 약점.

## 후속 (이번 미션 밖)
게임 표면은 대표 07-21 결정으로 9/10 동결. 남은 접근성 갭(Phaser 포인터 전용 이동·
표류병 키보드 대체)은 공개 유료 개방 시점의 P2로 이월.
