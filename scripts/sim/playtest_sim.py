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
rng = np.random.default_rng(2026)

N = 1000
age = rng.choice([5, 6, 7], N, p=[.35, .35, .30])
A = {a: age == a for a in (5, 6, 7)}

# ── 발달 파라미터 (가정치: 설계 가정 v1 — Phase B 실측으로 교체) ──
lit = np.where(age==5, .25, np.where(age==6, .60, .90))            # 한글 단어 읽기 가능
budget_med = np.where(age==5, 11, np.where(age==6, 14, 17))        # 지속 몰입 예산(분)
budget = np.exp(rng.normal(np.log(budget_med), .35))
VARIETY = 1.45                                                      # 5단계 세션 구조의 환기 배수
cap = budget * VARIETY                                              # 유효 몰입 용량(분)
passive1 = np.where(age==5, .30, np.where(age==6, .14, .06))       # 첫 CP '수동 시청'(선택 가능함을 모름)
lat_med = np.where(age==5, 7.0, np.where(age==6, 5.0, 4.0))        # CP 반응 잠복(초, 중앙값)
drag_fail = np.where(age==5, .25, np.where(age==6, .12, .06))      # 드래그 과업 실패
tap_fail  = np.where(age==5, .06, np.where(age==6, .03, .015))     # 120pt 탭 실패
voice_ok, TIMEOUT = .75, 15.0

def cp_outcome(mask_reached, first, cp0, opt3):
    """returns timeout(bool) among reached"""
    n = mask_reached.sum()
    p_pass = passive1[mask_reached] * (1.0 if first else 0.4) * (0.45 if cp0 else 1.0)
    passive = rng.random(n) < p_pass
    lat = np.exp(rng.normal(np.log(lat_med[mask_reached]), .5)) * (1.35 if opt3 else 1.0)
    return passive | (lat > TIMEOUT)

def first_session(adaptive, cp0, opt3):
    slen = np.where(age==5, 14, np.where(age==6, 17, 20)) if adaptive else np.full(N, 20)
    cp_times = [4, 9, 14]
    alive = np.ones(N, bool); drop_min = np.full(N, 99.0)
    to_counts = np.zeros(3)
    # 게임 좌절: 드래그 2연속 실패 시 이탈 위험(힌트가 70% 구조)
    g_fail = (rng.random(N) < drag_fail) & (rng.random(N) < drag_fail)
    frus_drop = g_fail & (rng.random(N) > .70)
    for i, t in enumerate(cp_times):
        reach = alive & (cap >= t) & (slen > t)
        to = np.zeros(N, bool); to[reach] = cp_outcome(reach, i==0, cp0, opt3)
        to_counts[i] = to[reach].mean() if reach.any() else 0
        # 수동/타임아웃은 몰입 소모 가중(혼란) → 용량 8% 차감
        cap_pen = np.where(to, cap*0.92, cap)
        if i == 1:  # 게임 슬롯 직후 좌절 이탈 반영
            newly = alive & frus_drop & (cap >= t)
            drop_min[newly] = np.minimum(drop_min[newly], t+1)
            alive &= ~newly
        globals().update()
        cap_local = cap_pen
    comp = alive & (cap >= slen)
    drop_at = np.where(comp, np.nan, np.minimum(drop_min, cap))
    return comp, to_counts, slen, drop_at

res = {}
for name, (ad, c0, o3) in {
  '기본(20분·3택·CP0없음)': (False, False, True),
  '개정(적응길이·2택·CP0)': (True, True, False)}.items():
    comp, tos, slen, drop = first_session(ad, c0, o3)
    res[name] = dict(comp=comp, first_to=tos[0], drop=drop, slen=slen)
    by = {a: comp[A[a]].mean() for a in (5,6,7)}
    print(f'{name}: 완주율 5세 {by[5]:.0%} / 6세 {by[6]:.0%} / 7세 {by[7]:.0%} | 첫CP 무응답 {tos[0]:.0%}')

# 첫 CP 무응답 by age × arm (별도 정밀 측정)
def first_cp_rate(cp0, opt3):
    reach = cap >= 4
    to = np.zeros(N, bool); to[reach] = cp_outcome(reach, True, cp0, opt3)
    return {a: to[A[a] & reach].mean() for a in (5,6,7)}
cp_base = first_cp_rate(False, True); cp_fix = first_cp_rate(True, False)
print('첫CP 무응답 by age — 기본:', {k: f'{v:.0%}' for k,v in cp_base.items()},
      '개정:', {k: f'{v:.0%}' for k,v in cp_fix.items()})

# A0 아바타·이름 (가정: 부모 근접 70%)
steps_home = rng.random((N,3)) < .96
naming_voice = rng.random(N) < voice_ok
naming_voice |= (~naming_voice) & (rng.random(N) < .75)            # 1회 재시도
naming_choseong = rng.random(N) < np.clip(lit*.8, .05, .95)
preset3 = rng.random(N) < .97                                       # 추천 3택
a0_done = steps_home.all(1)
print(f'A0 완료 {a0_done.mean():.0%} | 이름성공 음성 {naming_voice.mean():.0%} / 초성 {naming_choseong.mean():.0%} (5세 {naming_choseong[A[5]].mean():.0%}) / 추천3택 {preset3.mean():.0%}')

# 키오스크 (산만 환경): 스텝 생존
def kiosk(steps):
    p5, p67 = [.82,.85,.80,.78][:steps], [.92,.93,.90,.88][:steps]
    surv = np.ones(N)
    for i in range(steps):
        surv *= np.where(age==5, p5[i], p67[i])
    return {a: surv[A[a]].mean() for a in (5,6,7)}, surv.mean()
k3 = kiosk(4)  # 단짝+색+이름+데모
k2 = kiosk(2)  # 단짝+색만 (이름은 집에서)
print(f'키오스크 완료 — 3스텝+이름: 전체 {k3[1]:.0%} (5세 {k3[0][5]:.0%}) → 2스텝: {k2[1]:.0%} (5세 {k2[0][5]:.0%})')

# 작업실: 드래그 vs 탭
print(f'작업실 실패 — 드래그: 5세 {drag_fail[A[5]].mean():.0%} → 탭전환: 5세 {tap_fail[A[5]].mean()*2:.0%}')

# 회고(반복 선호) D+1
replay = rng.random(N) < np.where(age==5, .55, np.where(age==6, .40, .28))
print(f'D+1 회고 재생 선택: 5세 {replay[A[5]].mean():.0%} / 6세 {replay[A[6]].mean():.0%} / 7세 {replay[A[7]].mean():.0%}')

# ── 차트 ──
fig, ax = plt.subplots(2, 2, figsize=(13, 9))
fig.suptitle('아이별 가상 플레이테스트 — 가상 아동 코호트 1,000명 (5–7세) · 예측치', fontsize=13, fontweight='bold')
ages=[5,6,7]; x=np.arange(3); w=.38
a=ax[0,0]
b1=[res['기본(20분·3택·CP0없음)']['comp'][A[k]].mean()*100 for k in ages]
b2=[res['개정(적응길이·2택·CP0)']['comp'][A[k]].mean()*100 for k in ages]
a.bar(x-w/2,b1,w,label='기본안 (20분 고정)',color='#c0504d'); a.bar(x+w/2,b2,w,label='개정안 (적응 14/17/20분)',color='#2e6b34')
for xi,(v1,v2) in enumerate(zip(b1,b2)):
    a.text(xi-w/2,v1+1,f'{v1:.0f}',ha='center',fontsize=9); a.text(xi+w/2,v2+1,f'{v2:.0f}',ha='center',fontsize=9,fontweight='bold')
a.set_xticks(x,[f'{k}세' for k in ages]); a.set_ylim(0,105); a.set_title('첫 세션 완주율 (%)'); a.legend(fontsize=8); a.grid(alpha=.3,axis='y')
a=ax[0,1]
c1=[cp_base[k]*100 for k in ages]; c2=[cp_fix[k]*100 for k in ages]
a.bar(x-w/2,c1,w,label='3택 · 연습선택 없음',color='#c0504d'); a.bar(x+w/2,c2,w,label='2택 · CP0 연습선택',color='#2e6b34')
for xi,(v1,v2) in enumerate(zip(c1,c2)):
    a.text(xi-w/2,v1+.8,f'{v1:.0f}',ha='center',fontsize=9); a.text(xi+w/2,v2+.8,f'{v2:.0f}',ha='center',fontsize=9,fontweight='bold')
a.set_xticks(x,[f'{k}세' for k in ages]); a.set_title('첫 선택(CP) 무응답률 (%)'); a.legend(fontsize=8); a.grid(alpha=.3,axis='y')
a=ax[1,0]
mins=np.arange(1,21)
for k,c in zip(ages,['#c0504d','#c9a227','#2e6b34']):
    surv=[(cap[A[k]]>=m).mean()*100 for m in mins]
    a.plot(mins,surv,'-o',ms=3,color=c,label=f'{k}세')
a.axvline(14,ls=':',c='#888'); a.axvline(20,ls=':',c='#888')
a.text(14,8,'14분',fontsize=8,ha='center'); a.text(20,8,'20분',fontsize=8,ha='center')
a.set_title('세션 내 몰입 생존곡선 (분)'); a.set_xlabel('분'); a.set_ylabel('%'); a.legend(fontsize=8); a.grid(alpha=.3)
a=ax[1,1]
modes=['초성 입력','음성(재시도 포함)','추천 이름 3택']
v5=[naming_choseong[A[5]].mean()*100, naming_voice[A[5]].mean()*100, preset3[A[5]].mean()*100]
v7=[naming_choseong[A[7]].mean()*100, naming_voice[A[7]].mean()*100, preset3[A[7]].mean()*100]
xx=np.arange(3)
a.bar(xx-w/2,v5,w,label='5세',color='#c0504d'); a.bar(xx+w/2,v7,w,label='7세',color='#4472c4')
for xi,(u,v) in enumerate(zip(v5,v7)):
    a.text(xi-w/2,u+1,f'{u:.0f}',ha='center',fontsize=9); a.text(xi+w/2,v+1,f'{v:.0f}',ha='center',fontsize=9)
a.set_xticks(xx,modes); a.set_ylim(0,108); a.set_title('단짝 이름 짓기 성공률 (%) — 입력 방식별'); a.legend(fontsize=8); a.grid(alpha=.3,axis='y')
# [macOS patch] Write generated artifacts under the repo-local simulation output directory.
plt.tight_layout(); plt.savefig(OUT_DIR / '아이별_플레이테스트_시뮬.png', dpi=140, bbox_inches='tight')
print('chart saved')
