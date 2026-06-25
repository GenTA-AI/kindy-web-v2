# 게임 자동생성(PCG)·난이도조절(DDA)·리텐션 — 2차 근거 리서치

> 생성: 2026-06-04 · deep-research workflow (run wf_e3e3d15c-175)
> 통계: 검색축 6 · 소스 31 fetch · 주장 127 추출 → 25 검증(confirmed 22, **killed 3**) → 최종 9

## 요약

절차적 콘텐츠 생성(PCG)과 자동 문항 생성(AIG)은 교육 콘텐츠에 실제로 적용 가능하며, 데이터 기반(ML) PCG가 수작업·규칙 기반 휴리스틱보다 학습자 능력에 맞춘 콘텐츠를 더 정확히 생성하고(Hooshyar 2018), 영어 읽기 게임에서 맞춤 콘텐츠가 일반 콘텐츠보다 더 큰 학습 향상을 냈으며, MathRun처럼 무한 맵과 산수 문제를 동시에 자동 생성하는 구체적 교육 게임 사례도 존재한다. 난이도 자동 조절(DDA)은 일반 게임 메타분석에서 몰입(flow)에 가장 큰 영향을 주는 설계 요인(ES=.78, 개인화 난이도는 ES=1.19)이며, 적응형/지능형 튜터링 시스템(ITS)은 14,321명 대상 메타분석에서 중간 수준의 유의한 학습 향상(g=.41)을 보였고 ST Math의 대규모 RCT(16,307명)에서도 수학 성취에 유의한 효과가 확인되었다. 다만 성인 대상 사전등록 실험(N=311)은 난이도-기술 균형이 몰입·재미에 flow 이론의 예측만큼 직접적 영향을 주지 않을 수 있음을 보여 DDA를 단일 참여 레버로 과신하는 것을 경계하게 하며, 아동 인지훈련 게임의 다차원 확률적 DDA는 148명 데이터에서 1시간 내 각 아동의 ZPD에 수렴함을 입증했다. 핵심 공백: 거의 모든 근거가 영어권·일반 게임·성인/혼합 연령 표본으로, 한국 누리과정/2022 개정 교육과정 정렬, 한국어 L1 아동, 그리고 연령별 최적 세션 길이('10-20분' 가정 포함)에 대한 직접 실증 근거는 이번 조사에서 확보되지 않았다.

## 검증된 Findings

### 1. 데이터 기반(ML) PCG는 교육 게임 콘텐츠를 학습자 개인 능력에 맞춰 자동 생성할 수 있으며, 설계자의 직관 의존을 제거하고 규칙 기반 휴리스틱보다 난이도 타깃팅 정확도가 높다. 영어 읽기 게임 실증에서 맞춤 콘텐츠가 일반 콘텐츠보다 더 큰 학습 향상을 냈다.

- **신뢰도**: high · **투표**: 3-0 (모든 구성 claim 만장일치)
- **근거**: Hooshyar, Yousefi, Wang & Lim (2018), Journal of Computer Assisted Learning 34(6):731-739, DOI 10.1111/jcal.12280 (Korea University 소속 저자). 유전 알고리즘+SVM으로 콘텐츠를 자동 생성하며 'not dependent on designer's intuition'. 아동 영어 읽기 게임 실증에서 맞춤 난이도가 일반 콘텐츠 대비 더 큰 성과 향상, 데이터 기반 방법이 휴리스틱 기반보다 플레이어 성과 목표에 더 근접한 콘텐츠 생성. 한국 맥락 시사: 저자가 한국 대학 소속이나 대상은 영어 읽기로 한국어 L1·누리과정 검증은 아님. 단일 소규모 연구.
- **출처**: https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12280

### 2. PCG는 교육 게임에서 게임 환경과 산수 문제(문항)를 동시에 자동 생성하는 구체적 사례로 구현되었으며, 실시간 정량 성과 모델로 난이도를 자동 증감하는 DDA를 포함한다 (MathRun).

- **신뢰도**: high · **투표**: 3-0
- **근거**: Chen et al., MathRun, BCS HCI 2016, DOI 10.14236/ewic/HCI2016.77. '자동 생성된 무한 게임 맵과 절차적으로 생성된 다양한 난이도의 수학 문제'. 각 primitive map block에서 실시간 성과 평가로 레벨 자동 진행(점수 0-15→레벨 버퍼). 대상 연령 7-11세로 6-9세 밴드와 부분 중첩. 학습효과 통제연구가 아닌 적응 메커니즘 소규모 테스트라는 한계. 산수 item generation의 직접 교육 적용 증거.
- **출처**: https://www.researchgate.net/publication/310624414_MathRun_An_Adaptive_Mental_Arithmetic_Game_Using_A_Quantitative_Performance_Model

### 3. 자동 문항 생성(AIG)은 단일 item model + 알고리즘으로 수백~수천 개의 수학/어휘 문항을 생성할 수 있고(IGOR는 10개 모델에서 331,371문항), 인지모델 구축 후 수작업 대비 약 87배 빠르게 문항을 생성해 콘텐츠 대량 생산의 비용·확장성 병목을 해소한다.

- **신뢰도**: high · **투표**: 3-0 (두 구성 claim 모두)
- **근거**: Gierl & Lai (2013) EMIP 'Using Automated Processes to Generate Test Items' — 단일 item model로 수백~수천 문항; IGOR 사례 331,371문항/10 수학 모델(ERIC EJ974757, Tandfonline 2012 corroboration). 87배 수치는 BMC Medical Education 2023(PMC10700404): 수작업 27분/문항 vs 알고리즘 0.310분/문항. 중요 경고: 87배는 의학교육(외과 MCQ)에서 도출, 3-9세 수학/어휘로 직접 전이 불가. AIG가 게임 레벨이 아닌 '문항'을 생성한다는 점, 그리고 AIG 문항 품질이 인간 문항보다 높다는 별도 주장은 0-3으로 반증됨(품질 동등성/우월성은 입증 안 됨).
- **출처**: https://onlinelibrary.wiley.com/doi/abs/10.1111/emip.12018 ; https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10700404/

### 4. 검색 기반 PCG(search-based PCG)는 적합도(fitness) 함수로 후보 콘텐츠를 점수화하는 generate-and-test의 특수형으로 정식 정의되었고, '필수 콘텐츠'(게임 진행에 반드시 필요)는 항상 해결 가능해야 하며 난이도가 크게 어긋나선 안 된다. 교육 게임에서 문제/레벨은 필수 콘텐츠이므로 자동 생성 문항은 풀이 가능성과 난이도 보정 검증이 필수다.

- **신뢰도**: high · **투표**: 3-0 (정의·taxonomy), 2-1 (평가함수 ill-posed claim)
- **근거**: Togelius, Yannakakis, Stanley, Browne (2011) 'Search-Based PCG: A Taxonomy and Survey,' IEEE TCIAIG 3(3):172-186 — 분야의 canonical 정의 논문(julian.togelius.com PDF로 verbatim 확인). 필수/선택 콘텐츠 구분, 필수 콘텐츠는 intractable/unbeatable 불가. 평가함수 설계가 ill-posed(재미·몰입은 형식화·측정 곤란)라는 점은 2-1; 2021-2024 후속 연구(EDRL, 'Fun as Moderate Divergence')가 부분 정량화에 성공했으나 여전히 '주관적·미해결' 문제로 남아 핵심 주장은 유지. 교육 적용 함의는 claim 저자의 합당한 추론으로 명시됨.
- **출처**: https://www.semanticscholar.org/paper/Search-Based-Procedural-Content-Generation:-A-and-Togelius-Yannakakis/3288d7575f451d2e95f57cefc9566691ff272f1c

### 5. 난이도 조절은 게임 몰입(flow)에 가장 영향력 있는 설계 요인이다: DDA는 비적응 난이도 대비 flow에 ES=.78(중간 효과), 시작 시 기술 테스트로 설정한 개인화 난이도는 ES=1.19로 더 큰 효과를 냈으며, 유의했던 3개 분석 중 2개가 난이도 관련이었다.

- **신뢰도**: high · **투표**: 3-0 (DDA ES=.78, 난이도 최대 영향 요인), 2-1 (개인화 ES=1.19)
- **근거**: Caroux (2023), 'Flow in video games: A systematic review and meta-analysis' (41편, 2008-2022; HAL hal-04169163). DDA ES=.78, 개인화 난이도 ES=1.19, VR ES=.70. 경고: 난이도 관련 비교는 5개에 불과해 추정 정밀도 제한; 엔터테인먼트 게임의 flow 측정이며 학습성과·아동 대상 아님. 따라서 아동 교육 게임 적용은 간접 추론. 한국 맥락 직접 근거 없음.
- **출처**: https://www.researchgate.net/publication/372166474_Flow_in_video_games_A_systematic_review_and_meta-analysis_of_the_effects_of_game_design_choices

### 6. 적응형/지능형 튜터링 시스템(ITS)은 학습자 상태를 모델링해 개별화하며, 14,321명 대상 메타분석에서 중간 수준의 유의한 학습 향상(g=.41)을 냈고 초등학교를 포함한 모든 학년에서 효과가 유의했다. 단 1:1 인간 튜터링·소집단 수업 대비로는 유의한 우위가 없었다.

- **신뢰도**: high · **투표**: 3-0 (4개 구성 claim 모두 만장일치)
- **근거**: Ma, Adesope, Nesbit & Liu (2014), Journal of Educational Psychology 106(4):901-918, DOI 10.1037/a0037123 (107 effect sizes, 14,321명; PDF 직접 추출 확인). 전체 random-effects g=.41(p<.001). 교사 대집단 강의(g=.42), 비-ITS CBI(g=.57), 교과서/워크북(g=.35) 대비 우위; 1:1 인간 튜터링(g=-.11)·소집단(g=.05) 대비 무차이. 초등 g=.31(random-effects 유의)이나 fixed-effect/post-hoc에서는 초등이 중·고등·대학보다 낮음. 아동 3-9세·한국 특정 아님 — 적용은 추론. Kulik & Fletcher(2016)는 더 높은 median g~.66 보고(별개 메타분석, 비충돌).
- **출처**: https://www.apa.org/pubs/journals/features/edu-a0037123.pdf

### 7. 대규모 클러스터 RCT(16,307명, 52개 학년-학교 클러스터)에서 보조 적응형 수학 소프트웨어 ST Math가 표준화 수학 성취(California Standards Test, 3-5학년)에 유의한 처치 효과를 냈다(p<0.0005).

- **신뢰도**: medium · **투표**: 2-1
- **근거**: ERIC ED616922 (IES grant R305A090527, 2021). ITT HLM로 CST 수학 전 학년 difference-in-differences 유의(p<0.0005). What Works Clearinghouse 검토(Study 80703)는 'Meets WWC standards with reservations'(post-assignment enrollment bias 위험, baseline equivalence 충족)로 분석 표본 10,860로 축소되고 subdomain 수준에서는 Number Sense I만 유의. 표본이 미국(85% Hispanic, 70% ELL)이라 한국어 L1 적용성 미확립. 2-1 split이 medium 신뢰도 근거.
- **출처**: https://eric.ed.gov/?id=ED616922

### 8. 성인 대상 사전등록 실험(N=311, AI/MCTS 제어 난이도)에서 난이도-기술 균형은 경험적 재미와 행동적 참여(재플레이 선택)에 유의한 영향을 주지 않아, '균형 잡힌 도전이 재미를 극대화한다'는 flow 이론 예측과 배치되었고, 저자들은 DDA를 1차 참여 레버로 보는 근거를 한정(qualify)했다.

- **신뢰도**: high · **투표**: 3-0 (3개 구성 claim 모두)
- **근거**: Cutting, Deterding et al. (2023), Royal Society Open Science, DOI 10.1098/rsos.220274 (PMC9890114). 재미 ANOVA F(2,308)=1.29, p=0.277; 재플레이 Easy 20%/Balanced 29%/Hard 30%, χ²=3.40, p=0.183. 제목 자체가 'Difficulty-skill balance does not affect engagement and enjoyment.' 중대 경고: 표본은 성인(18-56, 평균 30.4, Prolific), 일반 전술 게임으로 아동·교육 게임 아님 — 3-9세 교육 DDA로 전이 시 반드시 caveat. 이 발견은 DDA를 반증하지 않고 '과신 경계'로 한정됨.
- **출처**: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9890114/

### 9. 아동 인지훈련 게임의 다차원 확률적 DDA는 과제 속도·복잡도·방해자극 부하 등 여러 파라미터로 실시간 난이도를 조절하며, 148명 아동 데이터에서 플레이 1시간 내 각 아동의 근접발달영역(ZPD)에 부합하는 적정 난이도로 빠르게 수렴했다.

- **신뢰도**: high · **투표**: 3-0 (수렴), 2-1 (다차원 파라미터 세부)
- **근거**: Pasqualotto et al., 'Modeling Skill Progression in Children Through Novel Multidimensional Probabilistic DDA,' GALA 2025 (Springer LNCS, DOI 10.1007/978-3-032-11043-5_25, Hebrew University). 'Legends of Hoa'Manu' 모듈형 인지훈련 게임, 148명, 1시간 내 ZPD 수렴. 경고: 난이도 수렴 행동을 평가한 것이지 학습성과 검증은 아님(claim도 이를 한정). 일반 인지훈련(작업기억/실행기능) 게임으로 누리/2022 교육과정 정렬 근거는 아님 — DDA-ZPD 수렴 메커니즘 근거.
- **출처**: https://link.springer.com/chapter/10.1007/978-3-032-11043-5_25

## ❌ 반증되어 폐기된 주장 (믿지 말 것)

- Automatic Item Generation (AIG) produced test items rated significantly higher in quality than human-authored items (M=4.92 vs M=2.93), with only one AIG item flagged for an implausible distractor, indicating automatic generation does not degrade item quality.
- AIG-generated items showed IRT difficulty estimates (-2.11 to 1.85 logits) comparable to manually written items (-2.11 to 2.02 logits) and supported high exam reliability (0.96), evidencing that auto-generated items provide valid, precise measurement.
- Cuteness in app design is associated with vulnerability and powerlessness, which stimulates the user's trust response and can be operationalized to inspire uncritical acceptance of a technology through emotional intimacy — making it a deliberate manipulative ('dark pattern') tactic rather than neutral aesthetics.

## 미해결 질문 (여전히 빈틈)

- 한국 누리과정(2019 개정)·초등 2022 개정 교육과정의 과학(자연탐구)·영어·수학(수와 연산)·음악·미술 영역별 성취목표와 내용체계는 무엇이며, CRA(구체-표상-추상)·일대일 대응·playful problem-solving·temporal contingency 같은 글로벌 best practice가 한국어 L1 아동 대상 연구로 검증·정렬된 근거가 있는가? (이번 조사에서 미확보)
- 연령 단계별(3-5세/5-7세/6-9세) 한 콘텐츠 세션의 최적 길이와 지속집중 가능 시간에 대한 직접 실증 데이터는 무엇이며, 사용자의 '10-20분' 가정은 어느 연령 밴드에 타당한가? (미확보)
- DDA/적응형 난이도가 flow가 아닌 다른 경로(자기효능감, 학습 진전감, 자율성)를 통해 아동의 학습·리텐션에 작용하는가 — Caroux 메타분석(flow 효과 큼)과 Cutting RCT(난이도-기술 균형 무영향) 간 모순을 아동 교육 게임 표본으로 직접 검증한 연구가 있는가?
- 주·월 단위 장기 리텐션(retention curve)과 시리즈 내러티브·반복 캐릭터·진행/보상 시스템(streak, progression, collection)의 정량 효과, 그리고 Khan Academy Kids/Duolingo ABC/Prodigy의 검증된 리텐션 사례 및 아동 과몰입·다크패턴 위험에 대한 실증 근거는? (이번 22개 claim에 미포함)

## Caveats

시간 민감성: 대부분 근거는 2011-2018년(PCG/AIG/ITS 기반 정의·메타분석)으로 정의적·기초적 성격이라 staleness 우려는 낮으나, ML/LLM 기반 PCG·AIG는 2021-2025년 사이 빠르게 발전 중이므로 최신 LLM 문항생성 사례는 추가 조사 필요. 표본 일반화 한계: (1) 아동 교육 게임 직접 근거는 Hooshyar(영어 읽기), MathRun(7-11세 산수), GALA 2025(인지훈련, 학습성과 미검증)뿐이고, DDA의 몰입·재미 효과 핵심 근거(Caroux 메타분석, Cutting N=311)는 모두 일반 게임·성인 표본이라 3-9세 교육 맥락 적용은 추론임. (2) flow 이론 내부 모순 존재 — Caroux 메타분석은 난이도가 flow에 큰 효과(ES=.78~1.19)라 보고하나 Cutting의 사전등록 RCT는 난이도-기술 균형이 재미·참여에 무영향이라 보고. 이는 'DDA 작동 메커니즘이 flow가 아닐 수 있음'을 시사하며 DDA를 무비판적 참여 엔진으로 설계하는 것을 경계해야 함. 출처 품질: ST Math RCT는 2-1 split이며 WWC가 'with reservations' 평가, 표본도 ELL 다수 미국 학생이라 medium 신뢰도. 반증된 주장: AIG 문항 품질이 인간 문항보다 우월/동등하다는 주장(품질 M=4.92 vs 2.93, IRT 동등성)은 0-3 반증 — 자동 생성이 문항 품질을 저해하지 않는다는 강한 결론은 이 근거로 내릴 수 없음. '귀여움=다크패턴' 주장도 0-3 반증. 한국 정렬·세션 길이: 핵심 조사 질문 4(누리과정/2022 개정 교육과정 영역별 성취목표 및 글로벌 best practice의 한국어 L1 검증)와 5(연령별 최적 세션 길이, '10-20분' 가정의 실증)에 대한 검증된 근거가 이번 22개 claim에 전혀 포함되지 않음 — 이 두 영역은 미충족 상태.

## 전체 소스

- https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12280
- https://www.researchgate.net/publication/310624414_MathRun_An_Adaptive_Mental_Arithmetic_Game_Using_A_Quantitative_Performance_Model
- https://www.semanticscholar.org/paper/Search-Based-Procedural-Content-Generation:-A-and-Togelius-Yannakakis/3288d7575f451d2e95f57cefc9566691ff272f1c
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10700404/
- https://onlinelibrary.wiley.com/doi/abs/10.1111/emip.12018
- https://www.researchgate.net/publication/372166474_Flow_in_video_games_A_systematic_review_and_meta-analysis_of_the_effects_of_game_design_choices
- https://eric.ed.gov/?id=ED616922
- https://www.apa.org/pubs/journals/features/edu-a0037123.pdf
- https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9890114/
- https://link.springer.com/chapter/10.1007/978-3-032-11043-5_25
- https://link.springer.com/chapter/10.1007/978-3-031-46053-1_5
- https://www.trypropel.ai/resources/duolingo-customer-retention-strategy
- https://www.justanotherpm.com/blog/the-psychology-behind-duolingos-streak-feature
- https://www.sciencedirect.com/science/article/abs/pii/S0950584922002518
- https://www.moe.go.kr/boardCnts/view.do?boardID=312&boardSeq=79419&lev=0&searchType=null&statusYN=W&page=1&s=moe&m=0301&opType=N
- https://repo.kicce.re.kr/handle/2019.oak/4997
- https://www.jccic.or.kr/2018/down/2019_%EA%B0%9C%EC%A0%95_%EB%88%84%EB%A6%AC%EA%B3%BC%EC%A0%95(%ED%95%B4%EC%84%A4%EC%84%9C).pdf
- https://ncic.re.kr/
- https://att.pmg.co.kr/FileData/CO/345~356%EC%AA%BD%20%EA%B0%9C%EC%A0%95%EC%82%AC%ED%95%AD(2022%20%EA%B0%9C%EC%A0%95%20%EA%B5%90%EC%9C%A1%EA%B3%BC%EC%A0%95)(1).pdf
- https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002650137
- https://kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART002551935
- https://journals.sagepub.com/doi/10.1177/09388982241292299
- https://pmc.ncbi.nlm.nih.gov/articles/PMC4448798/
- https://par.nsf.gov/servlets/purl/10346101
- https://repo.kicce.re.kr/bitstream/2019.oak/927/2/3-5%EC%84%B8%20%EC%97%B0%EB%A0%B9%EB%B3%84%20%EB%88%84%EB%A6%AC%EA%B3%BC%EC%A0%95%20%EA%B0%9C%EC%A0%95(%EC%95%88)%20%EA%B0%9C%EB%B0%9C%20%EC%97%B0%EA%B5%AC.pdf
- https://www.tandfonline.com/doi/abs/10.1080/09297040500488522
- https://pubmed.ncbi.nlm.nih.gov/20822238/
- https://sesameworkshop.org/our-work/what-we-do/support-for-families-affected-by-crisis/watch-play-learn/
- https://www.childrenandscreens.org/learn-explore/research/attention-media-use-and-children/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC10432573/
- https://www.mayoclinic.org/healthy-lifestyle/childrens-health/in-depth/screen-time/art-20047952