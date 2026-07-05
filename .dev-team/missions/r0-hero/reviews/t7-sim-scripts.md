# review: t7-sim-scripts
decision: approve
date: 2026-07-05

- 원본 3종 대비 diff = 허용 패치 2종만(폰트 폴백·출력 경로, `# [macOS patch]` 주석) — 리드 기계 대조 확인. 시드·수치 로직 무변경.
- 기대값 실측 일치: P_M9_ge_1000=0.028 · playtest 5세 59 · 차트 png 2본 생성 · 재현성 diff 통과(게이트).
- 환경 노트: pip DNS가 워커 샌드박스에서 차단 → 리드가 venv 의존성 설치 대행 후 게이트 통과. 워커는 py_compile·원본 diff까지 정직 보고(모범 handoff).
- reference/*.png(문서세트 차트 2본) 커밋은 scope 내(`scripts/sim/` 디렉토리 허용)·README 근거 자료로 타당.
