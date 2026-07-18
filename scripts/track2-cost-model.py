# Kindy Track-2 비용 시뮬레이션
# 단가 출처: mori-studio/src/adapters/gen-adapter.ts MODEL_PRICING (2026-07 기준)
# 환율 가정: 1 USD = 1,400 KRW

FX = 1400

# ---- 모델 단가 (USD) ----
PRICE = {
    "seedance20_per_s": 0.052,      # seedance-2.0 (영상 초당)
    "seedance20fast_per_s": 0.022,  # seedance-2.0-fast
    "kling30_per_s": 0.28,          # kling-3.0-elements (고품질)
    "lipsync_per_s": 0.05,          # sync-lipsync-v2
    "tts_per_char": 0.0001,         # gemini-2.5-flash-tts
    "keyframe_per_img": 0.04,       # flux-2 kindytoy lora
    "sfx_per_s": 0.001,             # mmaudio-v2
    "music_per_song": 0.035,        # minimax-music
    "llm_script_per_video": 0.30,   # Claude 감독 (IR덱 실측 $0.25 + 여유)
}

RETAKE = 1.4          # QC 리테이크 배수 (생성 실패/재생성 40% 가정)
SPEAK_RATIO = 0.6     # 립싱크 필요 구간 비율 (해설·명화 씬은 립싱크 불필요)
CHARS_PER_MIN = 1000  # 분당 한국어 대사·해설 글자 수
KEYFRAMES_PER_MIN = 4

def video_cost_usd(minutes: float, tier: str) -> float:
    s = minutes * 60
    per_s = {"saving": PRICE["seedance20fast_per_s"],
             "standard": PRICE["seedance20_per_s"],
             "premium": PRICE["kling30_per_s"]}[tier]
    gen = s * per_s * RETAKE
    lip = s * SPEAK_RATIO * PRICE["lipsync_per_s"]
    tts = minutes * CHARS_PER_MIN * PRICE["tts_per_char"]
    kf  = minutes * KEYFRAMES_PER_MIN * PRICE["keyframe_per_img"] * RETAKE
    sfx = s * PRICE["sfx_per_s"]
    music = PRICE["music_per_song"]
    llm = PRICE["llm_script_per_video"]
    return gen + lip + tts + kf + sfx + music + llm

# ---- 발송·운영 고정비 (KRW/월) ----
KAKAO_FRIENDTALK_PER_MSG = 15   # 친구톡 건당 ~15원 (리서치로 보정)
INFRA_FIXED = 50_000            # Cloud Run + Supabase + LB 등 월 고정
PG_FEE_RATE = 0.034             # 카페24/토스 결제 수수료 ~3.4%

def monthly(subscribers: int, videos_per_week: float, minutes_per_video: float,
            tier: str, price_krw: int):
    prod_per_video = video_cost_usd(minutes_per_video, tier) * FX
    videos_per_month = videos_per_week * 4.33
    production = prod_per_video * videos_per_month          # 전 구독자 공용 (방송형)
    kakao = subscribers * videos_per_month * KAKAO_FRIENDTALK_PER_MSG
    revenue = subscribers * price_krw
    pg = revenue * PG_FEE_RATE
    total_cost = production + kakao + INFRA_FIXED + pg
    profit = revenue - total_cost
    return dict(prod_per_video=prod_per_video, production=production,
                kakao=kakao, pg=pg, revenue=revenue,
                total_cost=total_cost, profit=profit,
                cogs_per_sub=total_cost/subscribers if subscribers else 0)

SCENARIOS = [
    ("A. 주2편×3분", 2, 3.0),
    ("B. 주3편×2.5분", 3, 2.5),
    ("C. 주1편×5분", 1, 5.0),
]
TIERS = ["saving", "standard", "premium"]
TIER_KO = {"saving": "절약(fast)", "standard": "표준(seedance2.0)", "premium": "프리미엄(kling)"}

print("=== 편당 제작원가 (원, 리테이크 1.4x 포함) ===")
for name, vpw, mins in SCENARIOS:
    row = [f"{video_cost_usd(mins, t)*FX:>10,.0f}" for t in TIERS]
    print(f"{name:<14} ({mins}분): " + " | ".join(f"{TIER_KO[t]} {r}" for t, r in zip(TIERS, row)))

print()
for price in (24_900, 34_900, 49_000):
    for subs in (20, 50, 100, 300):
        print(f"--- 가격 {price:,}원 × 구독자 {subs}명 ---")
        for name, vpw, mins in SCENARIOS:
            for t in ("standard",):
                m = monthly(subs, vpw, mins, t, price)
                print(f"  {name:<14} [{TIER_KO[t]}] 제작 {m['production']:>9,.0f} | "
                      f"매출 {m['revenue']:>10,.0f} | 손익 {m['profit']:>10,.0f} | "
                      f"1인당원가 {m['cogs_per_sub']:>8,.0f}")
        print()

# 손익분기 구독자수 (표준 티어)
print("=== 손익분기 구독자 수 (표준 티어) ===")
for price in (24_900, 34_900, 49_000):
    for name, vpw, mins in SCENARIOS:
        for subs in range(1, 500):
            if monthly(subs, vpw, mins, "standard", price)["profit"] >= 0:
                print(f"  가격 {price:,} × {name}: BEP {subs}명")
                break
