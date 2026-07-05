# t7-sim-scripts: 시뮬레이션 스크립트 3종 이식 + 재현 검증
effort: medium

## Goal
아이별 문서세트의 시뮬 스크립트 3종(`playtest_sim.py`=Phase B 재시뮬 러너, `simulate.py`=재무 몬테카를로, `build_model.py`=재무모델 xlsx 빌더)을 `scripts/sim/`으로 이식하고, macOS 적응 패치 2곳만 적용한 뒤 시드 고정 재현을 검증한다. 주간 그로스 루프(금 60분)의 ③시뮬 재실행 도구가 된다. 절차 정본: `docs/plan/04_R0_EXECUTION_PLAN.md` Task 2.6 (명령·기대값 사전 검증돼 있음 — 그대로 따르라).

원본: `/Users/jongwonlee/Downloads/아이별_문서세트_2026-07-05/02_시뮬레이션_스크립트/` (읽기 전용 소스)

## Scope
- `NEW: scripts/sim/` (playtest_sim.py, simulate.py, build_model.py, README.md, out/ — out은 gitignore)
- `.gitignore` (scripts/sim/out/·scripts/sim/.venv/ 2줄 추가만)

## Constraints
- **원본 로직 변경 금지** — 허용 패치 2곳 한정(04 Task 2.6): ① 리눅스 나눔폰트 절대경로 → AppleGothic 폴백 ② 하드코딩 출력 경로 `/home/claude/` → `scripts/sim/out/`. 패치 지점에 `# [macOS patch]` 주석.
- venv는 `scripts/sim/.venv`(gitignore), deps: numpy·matplotlib·openpyxl. pip 네트워크 실패 시 중단하고 handoff에 기록(리드가 ops 처리).
- 시드 고정(2026/42) 변경 금지. 산출물(png·xlsx·json)은 out/으로만, 커밋 금지.
- README.md: 실행법 3줄 + 주간 그로스 루프 연결(00 문서 §6) + 기대값 표(아래 Validation 값).
- worktree 실행이라 node_modules 불필요(파이썬 전용). npm 명령은 돌리지 마라(Validation의 lint 제외 — 그건 저장소 무결 확인용이며 node_modules 없으면 `npm ci` 먼저).

## Deliverables
- scripts/sim/ 3본+README, 2회 실행 결과 diff 동일(재현성), 기대값 일치

## Validation
```bash
test -f scripts/sim/playtest_sim.py && test -f scripts/sim/simulate.py && test -f scripts/sim/build_model.py && echo files-ok
git check-ignore scripts/sim/out && echo ignore-ok
scripts/sim/.venv/bin/python scripts/sim/simulate.py > /tmp/sim1.txt 2>&1; scripts/sim/.venv/bin/python scripts/sim/simulate.py > /tmp/sim2.txt 2>&1; diff /tmp/sim1.txt /tmp/sim2.txt && echo reproducible
grep -o "P_M9_ge_1000=0.028" /tmp/sim1.txt || grep -iq "0.028\|2.8%" /tmp/sim1.txt && echo pm9-ok
scripts/sim/.venv/bin/python scripts/sim/playtest_sim.py > /tmp/pt1.txt 2>&1; grep -Eq "59|0\.59" /tmp/pt1.txt && echo playtest-ok
ls scripts/sim/out/ | grep -qi "png\|xlsx" && echo outputs-ok
```

## Handoff requirements
End your final message with: summary, files_changed, validation, risks, handoff_note — 특히 기대값과 다르게 나온 수치가 있으면 원문(04 Task 2.6 기대값 표) 대비로 보고.
