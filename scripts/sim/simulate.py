import os
from pathlib import Path
import numpy as np, json
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
fp = '/usr/share/fonts/truetype/nanum/NanumSquareRoundB.ttf'
# [macOS patch] Linux Nanum font path is absent on macOS; keep Nanum when present, otherwise fall back.
if os.path.exists(fp):
    font_manager.fontManager.addfont(fp)
    plt.rcParams['font.family'] = font_manager.FontProperties(fname=fp).get_name()
else:
    plt.rcParams['font.family'] = 'AppleGothic'
plt.rcParams['axes.unicode_minus'] = False
OUT_DIR = Path(__file__).resolve().parent / 'out'
OUT_DIR.mkdir(parents=True, exist_ok=True)

rng = np.random.default_rng(42)
N, M = 10000, 36
tri = lambda a, m, b: rng.triangular(a, m, b, N)

# 불확실 변수 (재무모델 v1.0 기본값 = mode)
qr, signup, trialr = tri(.03, .06, .09), tri(.35, .45, .55), tri(.50, .60, .70)
conv, churn, cac = tri(.30, .45, .60), tri(.15, .25, .35), tri(25000, 30000, 45000)
sess = tri(800, 1200, 1600)
delay = rng.integers(0, 4, N)  # 도서관·B2G 계약 지연 0~3개월

# 결정 변수 (엑셀과 동일)
lib = np.array([2,3,5,6,7,8,10,12,15,17,19,22,25,28,31,34,37,40,44,48,52,56,60,65,70,75,80,85,90,95,100,105,110,115,120,125], float)
mkt = np.array([0,1e6,2e6]+[3e6]*3+[5e6]*3+[8e6]*3+[12e6]*6+[20e6]*6+[30e6]*12)
b2g = np.array([0,0,1,1,2,2,3,3,4,4,5,5,6,7,7,8,9,10,11,12,13,14,15,16,18,19,21,22,24,25,26,27,28,29,30,32], float)
staff = [(3e6,1),(4.5e6,1),(2e6,1),(3e6,7),(2e6,10),(4.5e6,13),(3.5e6,13)]
FIXED, CONTENT, FEE, INFRA, VAT = 2.5e6, 1.6e6, .033, 1300., .10

subs = np.zeros(N); cash = np.zeros(N)
subsT = np.zeros((N, M)); cashT = np.zeros((N, M)); opT = np.zeros((N, M))
rev3, ded3 = [], []
for t in range(1, M + 1):
    idx = np.clip(t - 1 - delay, 0, M - 1)
    L, B = lib[idx], b2g[idx]
    adds = L * sess * qr * signup * trialr * conv + mkt[t-1] / cac
    subs = subs * (1 - churn) + adds
    arpu = 19000 if t <= 6 else 25000 * .92
    bill = subs * arpu + subs * .10 * 7000
    b2c_net = bill / 1.1; b2g_net = B * 18e6 / 12
    rev = b2c_net + b2g_net
    cogs = bill * FEE + subs * INFRA + CONTENT
    pay = sum(s for s, st in staff if st <= t) * 1.19
    sga = pay + mkt[t-1] + FIXED
    op = rev - cogs - sga
    vat = np.zeros(N)
    rev3.append(rev); ded3.append(CONTENT + mkt[t-1] + FIXED)
    if t >= 4 and (t - 1) % 3 == 0:
        vat = np.maximum(0, (sum(rev3[-4:-1]) - sum(ded3[-4:-1])) * VAT)
    inflow = bill + B * 18e6 / 12 * 1.1 + (300e6 if t == 1 else 0) + (30e6 if t == 2 else 0)
    cash = cash + inflow - (cogs + sga + vat)
    subsT[:, t-1], cashT[:, t-1], opT[:, t-1] = subs, cash, op

pct = lambda a, p: np.percentile(a, p)
mincash = cashT.min(1); be = np.where(opT > 0, np.arange(1, M+1), 99).min(1)
R = {
 'M2_paid_P10_50_90': [round(pct(subsT[:,1], p)) for p in (10,50,90)],
 'M9_paid_P10_50_90': [round(pct(subsT[:,8], p)) for p in (10,50,90)],
 'M18_paid_P10_50_90': [round(pct(subsT[:,17], p)) for p in (10,50,90)],
 'mincash_eok_P10_50_90': [round(pct(mincash, p)/1e8, 2) for p in (10,50,90)],
 'breakeven_month_P10_50_90': [int(pct(be, p)) for p in (10,50,90)],
 'P_M2_ge_20': round(float((subsT[:,1] >= 20).mean()), 3),
 'P_M9_ge_1000': round(float((subsT[:,8] >= 1000).mean()), 3),
 'P_M18_ge_10000': round(float((subsT[:,17] >= 10000).mean()), 3),
 'P_BE_by_M18': round(float((be <= 18).mean()), 3),
 'P_cash_below_0': round(float((mincash < 0).mean()), 4),
 'P_cash_below_1p5eok': round(float((mincash < 1.5e8).mean()), 3),
}
print(json.dumps(R, ensure_ascii=False, indent=1))

# Sim2: 콘텐츠 소진 — 가입 코호트별, 테뉴어 2개월 내 소진 확률
def exhaust(pipe_simple, pipe_inter, launch=28, inter_eq=3.0, rewatch=1.3, Nc=4000):
    out = []
    for join in range(1, 13):
        r = rng.triangular(16, 26, 39, Nc)
        ex = np.zeros(Nc, bool)
        for k in (1, 2):
            t = join + k
            L = launch + pipe_simple * max(0, t - 1) + inter_eq * pipe_inter * max(0, t - 3)
            ex |= (r * k) > (L * rewatch)
        out.append(ex.mean())
    return np.array(out)
exA, exB, exC = exhaust(8, 0), exhaust(12, 0), exhaust(6, 2)
print('exhaust_mean A=%.2f B=%.2f C=%.2f | join1-3 A=%s C=%s' % (
    exA.mean(), exB.mean(), exC.mean(), np.round(exA[:3],2).tolist(), np.round(exC[:3],2).tolist()))

# Sim3: 제작 용량
gen_min = rng.triangular(2, 4, 8, 5000)
wall_h = 200 * gen_min.mean() / 12 / 60
print('interactive_ep_wallclock_h=%.1f | HITL(min): simple6=90 inter2=180 total=270 vs capacity 2400 | mix_cost_mo=%.1fM' % (wall_h, (6*2e5+2*3e5)/1e6))

# 차트
fig, ax = plt.subplots(2, 2, figsize=(13, 9))
fig.suptitle('Kindy 런칭·그로스 시뮬레이션 (몬테카를로 10,000회 · 36개월)', fontsize=14, fontweight='bold')
x = np.arange(1, M+1)
a = ax[0,0]
for p, c, lb in [(10,'#c0504d','P10 (하위 10%)'),(50,'#2e6b34','P50 (중앙값)'),(90,'#4472c4','P90 (상위 10%)')]:
    a.plot(x, np.percentile(cashT, p, 0)/1e8, color=c, lw=2, label=lb)
a.fill_between(x, np.percentile(cashT,10,0)/1e8, np.percentile(cashT,90,0)/1e8, color='#8db38b', alpha=.25)
a.axhline(0, color='k', lw=.8); a.axhline(1.5, color='#c0504d', ls=':', lw=1.2, label='경보선 1.5억')
a.set_title('현금 잔고 궤적 (억원)'); a.set_xlabel('월(M)'); a.legend(fontsize=8); a.grid(alpha=.3)
a = ax[0,1]
a.hist(np.clip(subsT[:,8], 0, 3000), bins=60, color='#5a8f6e', edgecolor='white')
a.axvline(1000, color='#c0504d', lw=2, label='Pre-A 트리거 1,000')
a.axvline(np.median(subsT[:,8]), color='#2e6b34', lw=2, ls='--', label='중앙값 %d' % np.median(subsT[:,8]))
a.set_title('M+9 유료 가구 분포 · P(≥1,000)=%.0f%%' % (R['P_M9_ge_1000']*100))
a.set_xlabel('유료 가구'); a.legend(fontsize=8); a.grid(alpha=.3)
a = ax[1,0]
labels = ['M2≥20\n(스프린트)', 'M9≥1,000\n(Pre-A)', 'M18≥10,000\n(Series A)', '흑자전환\n≤M18', '현금\n무고갈']
vals = [R['P_M2_ge_20'], R['P_M9_ge_1000'], R['P_M18_ge_10000'], R['P_BE_by_M18'], 1-R['P_cash_below_0']]
bars = a.bar(labels, [v*100 for v in vals], color=['#2e6b34' if v>=.7 else '#c9a227' if v>=.3 else '#c0504d' for v in vals])
for b, v in zip(bars, vals):
    a.text(b.get_x()+b.get_width()/2, v*100+1.5, '%.0f%%' % (v*100), ha='center', fontsize=10, fontweight='bold')
a.set_ylim(0, 115); a.set_title('마일스톤 달성 확률'); a.grid(alpha=.3, axis='y')
a = ax[1,1]
jm = np.arange(1, 13)
a.plot(jm, exA*100, 'o-', color='#c0504d', label='A: 심플 월 8편 (현 계획)')
a.plot(jm, exB*100, 's-', color='#c9a227', label='B: 심플 월 12편')
a.plot(jm, exC*100, '^-', color='#2e6b34', label='C: 심플 6편 + 인터랙티브 2편')
a.set_ylim(-3, 103)
a.set_title('콘텐츠 소진 위험 — 가입 후 2개월 내 소진 확률'); a.set_xlabel('가입 시점 (M)'); a.set_ylabel('%')
a.legend(fontsize=8); a.grid(alpha=.3)
plt.tight_layout()
# [macOS patch] Write generated artifacts under the repo-local simulation output directory.
plt.savefig(OUT_DIR / 'Kindy_시뮬레이션_결과.png', dpi=140, bbox_inches='tight')
print('chart saved')
