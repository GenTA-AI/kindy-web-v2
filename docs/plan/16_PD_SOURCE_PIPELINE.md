# PD 소스 파이프라인 — 수천 편 자동생산용 자산 소싱 정본 (2026-07-21)

16개 에이전트 병렬 조사 + 적대적 라이선스 검증. doc 15 §8(진짜-이미지 우선) 실행 인프라.
**한 줄 결론: 권리무결 정지자산 100만+ 점 · 시리즈 C 삽화 플레이트 수만+ · 시리즈 B 오디오 실질 무제한 → '수천 편' 자동생산 큰 마진 충당. 유일 병목 = 한국 전래 서사삽화(구조적 공백).**

## 규모 요약 (실측)
| 트랙 | 소스 | 볼륨 |
|---|---|---|
| A·D 서양 명화(정지자산) | Met+Rijks+Paris+AIC+NGA+Cleveland | **Tier1만 130만+ 점** (Met 406k·Rijks 70~80만·Paris 150k·AIC 52k·NGA 51k·Cleveland 30k) |
| C 옛이야기 삽화 | Internet Archive + Wikimedia | 삽화 동화 수천 권 × 책당 수십 플레이트 = **추출 플레이트 수만+** |
| B 클래식·오페라 | IMSLP 악보 → 자체렌더 | **악보 86.8만 / 작품 25.8만** = 사실상 무제한 (실음원은 Musopen CC0 ~1,800) |
| 한국(Tier2) | 국박·e뮤지엄·국가유산 | 국박 고화질 7,300 · e뮤지엄 17만 이미지 · 국가유산 원천데이터 48만 |

## Tier 1 — CLEAR (상업+2차저작 무제한, 즉시·대량)
| 소스 | 라이선스 | 접근 | 볼륨 | 먹이는 시리즈 |
|---|---|---|---|---|
| **Met (미국)** | CC0 1.0 (isPublicDomain 서브셋) | REST API + GitHub CSV + IIIF | 오브젝트 47.2만 / CC0 이미지 ~406k | A·D, 판화·삽화→C 보조 |
| **Art Institute Chicago** | CC0 1.0 (description만 CC-BY→텍스트 제외) | API + GitHub 야간덤프 + IIIF | 아트워크 13.1만 / CC0 ~52k | A·D |
| **NGA (워싱턴)** | CC0 1.0 (open-access 플래그) | opendata GitHub CSV + IIIF | 13만+ / CC0 ~51k | A·D |
| **Rijksmuseum (네덜란드)** | CC0 / PDM (2D 충실복제=신저작권 없음) | OAI-PMH/LDES/풀덤프 **무API키** | 고해상 ~70~80만 (5,000~12,000px) | A(네덜란드 황금기 최상)·D·판화→C |
| **Cleveland (미국)** | CC0 1.0 (share_license_status==CC0) | Open Access API + GitHub | 6.4만 / CC0 ~30k | A·D |
| **Paris Musées (프랑스)** | CC0 1.0 (복제 레이어까지 해방) | API (license==CC0 필터 필수) | CC0 15만+ | A·D |
| **Internet Archive** | PD 책 스캔(충실복제=신저작권 없음). **Google-스캔 제외** | advancedsearch API → JP2/PDF 플레이트 추출 | PD 책 100만+ / 삽화 플레이트 수만+ | **C 1순위 대량엔진**(래컴·뒬락·닐센·크레인·빌리빈·도레·테니얼·그리너웨이·부테드몽벨 원본 전권) |
| **IMSLP** | PD 원판 스캔=신저작권 미발생. 자체렌더=저작인접권 0 | 카테고리 하베스트 | 악보 86.8만 / 작품 25.8만 | **B 최적**·C 삽입곡·E |
| **Musopen** | CC0/PD 헌정 녹음만(NC 필터) | API (JSON, 라이선스 검증) | CC0 녹음 ~1,800 | B 실음원 보조 |

## Tier 2 — CONDITIONAL (조건부, 게이트 필요)
- **Smithsonian** (CC0 플래그 항목만, ~2.8M+, 제3자권 이용자 책임) — A 갭필·D·E
- **Getty Open Content** (CC0이나 항목별 rights 게이트, 벌크덤프 약함, ~88k+)
- **Wikimedia Commons** (파일별 라이선스 검증, PD-Art=미국 세이프하버·한국 자동확장 아님) — C 히어로 플레이트(도레 574+316·크레인 105·뒬락 17+·빌리빈 14+)
- **Project Gutenberg** (미국 PD, 단 'Project Gutenberg' 명칭=상표→완전 제거) — C 텍스트 페어링
- **NYPL PD**(180k+, 권리 최청정) · **LoC Free to Use**(역사 세트) · **Europeana**(reusability=open & rights∈{CC0,PDM,CC-BY}만) — D 보조
- **국립중앙박물관 e뮤지엄 (KOGL)** — **제0/제1유형만** (국박 자관 촬영본=제1유형, 고화질 7,300·e뮤지엄 17만) — A(김홍도·민화)·C 배경·D
- **국립민속박물관·국가유산청·국립중앙도서관 (KOGL 제0/1)** — 국가유산 원천데이터 48만 개방(2024). 견우직녀=덕흥리 고분벽화 도상(재현물 권리 별도) — A 민화·C 민속배경·D
- **Unsplash/Pexels** (CC0 아닌 플랫폼 라이선스, Pexels ToS는 대량수집·ML 금지→소량 수동, 인물·로고 없는 컷+I2V만)

## AVOID — 밟으면 안 되는 함정 (규모에서 오염 복제)
- **Google Arts & Culture** — 재사용 라이선스 아님(감상 플랫폼, 파트너 소유). 원 소장기관 CC0에서 재취득.
- **Flickr Commons** — 'no known copyright'는 라이선스도 워런티도 아님. 스미소니언은 같은 사진을 여기선 비상업 주장(모순).
- **BnF Gallica** — PD여도 **상업 재사용에 요금**. 유료제품 직접사용 불가 → IA/Commons 대체.
- **IA Great 78 / 외국 유명 78rpm** — 저작인접권 잔존, **대법원 2025.12.11.(2022도2827)+RIAA 합의 ~4,142곡 차단**. 실음원은 CC0만.
- **Free Music Archive** — 현대 인디+NC 혼재, B 오답.
- **National Gallery London 등 Bridgeman류** — PD 원작이라도 촬영본 재현권 주장. CC0 명시 기관만.
- **공유마당·규장각** — 유형 혼재·항목별 미명시, 유료제품 직접투입 불가(교차검증용만).
- **라이선스 클래스: CC-BY-SA(독소 share-alike)·NC·ND·KOGL 제2/3/4유형** — 전량 차단. **CC0/PD/CC-BY·KOGL 제0/1만 통과.**

## 5시리즈 커버리지
- **A 살아움직이는 명화**: Tier1 6개 CC0 기관이 백본. 서양 pre-1900 회화 사실상 전량 PD. 한국 명화(김홍도·민화)=국박 KOGL 제1유형.
- **B 클래식/오페라**: IMSLP 악보→**자체 오디오 렌더가 백본**(저작인접권 0) + Musopen CC0 실음원. 외국 유명음반 전면 금지.
- **C 옛이야기**: Internet Archive(자체 스캔, Google-스캔 제외)=1순위 대량엔진. 태생 삽화가 9인 전원 사망 ≤1962(PD 확정). 발행 ≤1929 안전선.
- **D 인문 보는눈**: A 6기관(명화로 장소) + Smithsonian·Europeana·LoC·국가유산청.
- **E 창작공방**: 소재제약 없는 전 CC0/PD 풀 자유활용.
- **⚠ 구조적 공백 = 한국 전래**: 해와달오누이(활자화 1922)·흥부놀부(방각본 텍스트 위주)엔 PD 서사삽화 없음(있는 판본은 20~21c 그림책=보호중). 견우직녀만 덕흥리 고분벽화(408년) 고대도상 예외. → **한국 C편은 서양편과 동급 대량자동 생산 불가.** 대응: doc 15 §8-5(전통 배경·목판·딱지본·해외CC0·**소유 화풍**).

## 코퍼스 자산 스키마 (에셋 1건 = ~30필드, 감사 방어)
핵심: `asset_id`(content_hash 파생) · `source_institution` · `source_url`(스크랩금지 증거) · `artist` + **`artist_death_year`**(≤1962=한국 PD) · `publication_year`(≤1929 안전선) · **`license_code`**(CC0/PD-Art/PDM/KOGL-0/KOGL-1/CC-BY) · `license_url`(근거) · `license_verified` · `commercial_ok` · **`derivative_ok`**(ND·제3/4=false) · `attribution_required`+string · `scanner_source`(Google-스캔 제외) · **`reproduction_rights_clear`**(국박제1=true·규장각=false) · `third_party_rights_flag`(상표·초상) · `jurisdiction_note`(US-PD≠KR-PD·음원 인접권) · `hi_res`+width_px · `content_type` · `series_fit`(A~E) · `integrity_checked` · `content_hash`(sha256+pHash) · `dedup_group_id` · `rights_audit_status`(auto_pass/needs_human/rejected).

## 자동 수집·권리게이트 파이프라인 (9단계)
1. **소스 커넥터 + 메타 우선 수집** — 소스별 전용 커넥터로 메타/ID 벌크(이미지는 2단계).
2. **라이선스 하드게이트(유일한 법적 게이트)** — PD 플래그 강제(isPublicDomain==true 등), 비CLEAR·CC-BY-SA/NC/ND·KOGL 2/3/4 전량 폐기.
3. **판본·PD 시효 판정** — 작가 사망 ≤1962 AND 발행 ≤1929 동시. 닐센(1957)·뒬락(1953) 1930년대 판본=needs_human.
4. **재현권·제3자권 검증** — 기관이 촬영 재현권 CC0 방기했나(국박제1=OK·규장각=reject). 상표·초상 플래그.
5. **에셋 2단계 취득** — 게이트 통과 ID만 API/IIIF 최대해상도 페치. IA는 JP2에서 플레이트 추출.
6. **무결성 확인** — sha256 + 원판 검증(크롭·재업로드·Google 워터마크·PG 헤더 아님).
7. **중복제거** — pHash로 동일작 병합, 애그리게이터보다 **원기관 CC0 원판 우선**.
8. **코퍼스 적재 + 감사 로그** — 전 게이트 그린일 때만 auto_pass. 표본 인간감사 상시, append-only 프로버넌스 로그(법적 방어).
9. **시리즈 라우팅** — series_fit로 A~E 제작 큐 분배. B=IMSLP 자체렌더, 한국 C=분위기·설정 풀로만(공백 명시 전달).
