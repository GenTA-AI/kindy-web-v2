# Simulation Scripts

```bash
python3 -m venv scripts/sim/.venv && scripts/sim/.venv/bin/pip install numpy matplotlib openpyxl
scripts/sim/.venv/bin/python scripts/sim/simulate.py && scripts/sim/.venv/bin/python scripts/sim/playtest_sim.py
scripts/sim/.venv/bin/python scripts/sim/build_model.py
```

Seeds are fixed in source: `playtest_sim.py` uses `np.random.default_rng(2026)`, and `simulate.py` uses `np.random.default_rng(42)`.

Weekly growth loop link: run this in the Friday 60-minute loop from `docs/plan/00` section 6, starting R1 first Friday (W3, 2026-07-24): 1. check five observed variables, 2. update the financial model blue input cells, 3. rerun `simulate.py`, 4. reprioritize backlog from probability movement, 5. check risk triggers.

macOS adaptation patches:

```diff
- /usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf
+ use Nanum when present, otherwise AppleGothic fallback  # [macOS patch]

- /home/claude/<artifact>
+ scripts/sim/out/<artifact>  # [macOS patch]
```

Expected values:

| Check | Expected |
| --- | --- |
| `simulate.py` M+9 paid P10/50/90 | `558 / 701 / 884` |
| `simulate.py` `P_M9_ge_1000` | `0.028` (2.8%) |
| `playtest_sim.py` first two lines | base 5-year completion `20%`, revised 5-year completion `59%` |
| `build_model.py` | `out/Kindy_재무모델_v1.0.xlsx` and stdout `saved` |
