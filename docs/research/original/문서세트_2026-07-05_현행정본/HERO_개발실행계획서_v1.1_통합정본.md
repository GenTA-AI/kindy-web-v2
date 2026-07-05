# HERO 개발실행계획서 v1.1 — 통합 정본 (플레이테스트 v2.1 반영)

대상: 개발팀(DEV+CC 에이전트) | 기준일: 2026-07-05 | **v1.0 대체.** 화면·카피 SSOT=제품기획서 v2.2, 재무 입력=재무모델 v1.3, 검증 근거=플레이테스트 리포트 v2.1. 코드네임 HERO, 서비스명 「아이별」(가칭).
v1.1 변경 요약: Usability Gate 신설(릴리즈 Exit에 아동 지표) · 계측 7종 추가 · 신규 티켓 6(E13-15~18, E15-1~2) · AC 개정 3건(키오스크 2스텝·A3 탭·CP 가변 옵션) · 005 마이그레이션(연령 기본값) · Phase B W6–7 확정.

---

## 0. 완성의 정의와 릴리즈 트레인 (Usability Gate 포함)

**완성 = R4 Exit (W24)**: ① Kids 정식 심사 통과·출시 ② 티어 판정 반영 완료 ③ 코호트 대시보드 W4·steady churn 자동 산출 ④ 콘텐츠: 주인공 24+옛이야기 16+인터랙티브 6 ⑤ 도서관 10관+ ⑥ 데이터룸 10폴더 ⑦ 런북·온콜·백업 리허설. 전 기능 피처 플래그(hero_layer/hero_worldstate/hero_branching/tier_b/tier_c/kiosk_demo_v2/ageband_defaults) — 어느 플래그를 꺼도 무결 복귀.

| 릴리즈 | 주차 | 사업·기능 Exit | **Usability Gate [가정→실측 확정]** |
|---|---|---|---|
| R0 | W1–2 | G0 전항 + 아바타 발주·world_state 스키마 머지 + 005 적용 | — |
| R1 | W3–8 | 유료 20+ · 퍼널 5변수 실측 · 아바타·호명·단짝·책장·CP0 라이브 · 데모 v2 A/B · 티어A 실험 · **Phase B(W6–7) 완료** | 입장 여행 완주 ≥85% · 첫 정규 세션(적응) ≥65% · 5세 첫 CP 무응답 ≤25% · 이름 성공 ≥90% — 실측이 시뮬 예측 −10%p 초과 이탈 시 게이트 재심 |
| R2 | W9–12 | world_state·연속성 10/10 · 분기 CP 유료 배포 · 티어B 실험 | CP 응답률 ≥75% 유지 · replay 진입률 계측 개시 |
| R3 | W13–16 | 오케스트레이터 v1 · 리캡(티어C) · 베타 50 · 생일 파일럿 | 리포트 열람 ≥60% · 티어A 판정 자료 확정 |
| R4 | W17–24 | Kids 심사 · 형제 세계 · POD · 안정화 · 데이터룸 자동화 | steady churn 실측(M4) 대시보드 가동 |

## 1. 아키텍처 (v1.1 델타: product_defaults 설정 서비스)

v1.0 구조 유지 + **연령 기본값 서비스**: 세션 부트스트랩 시 출생연월→밴드 판정→product_defaults 반환(캐시 24h, 홀드아웃 배정 포함). 개인화 렌더 2경로 유지: 사전조합(티어A 스틸, 에피소드당 144조합 배치) / 온디맨드(티어B·C, 폴백 필수).

## 2. world_state 명세 (v1.0 §2 전문 유효 — 요지)

이벤트 소싱: story_choice/episode_completed/expression_saved → 리듀서 → world_states(child_id,version) 스냅샷. 브리프 주입 계약(digest ≤500자+open_threads), Story Smith 의무 3규칙(기한 스레드 회수·관계 무모순·아이템 재등장), Guardian 연속성 5룰 자동 반려, 실패 시 중립판 폴백. 골든테스트 10(부록 A) CI 필수.

## 3. 아바타·이름 시스템 (v1.1 개정 반영)

조합 3×8×6=144, 사진·카메라 코드 부재를 테스트로 보증(E13-10), 실사 유사 QC. **이름 3모드[결정 D5]**: 추천 3택(큐레이션 풀 100·금칙 검사) → 음성(재시도 1회) → 초성(6·7세 판정 시만 렌더). 기본 "단짝아"+상시 개명. **키오스크는 이름 미수집[결정 D6]** — 관련 수집 코드 부재 테스트 포함. 사전조합 경제: 에피소드당 주인공 스틸 2컷×144 ≈ +$12(공유), 아이별 한계원가≈호명 TTS.

## 4. 마이그레이션

004_hero.sql — v1.0 §4 전문 그대로 적용(avatars/world_states/bookshelf/personal_renders/episodes 슬롯 컬럼). 신규 **005_usability.sql**:

```sql
create table product_defaults (
  age_band int primary key,              -- 5 | 6 | 7
  session_len_min int not null,          -- 14/17/20
  cp_options int not null,               -- 2/2/3 (콘텐츠 variants에서 서브셋)
  cp_lead_count int not null,            -- 2/1/0
  tts_rate numeric not null,             -- 0.9/1.0/1.0
  workshop_mode text not null,           -- 'tap'/'tap'/'tap_drag_exp'
  refresh_points int not null,           -- 6/5/5
  updated_at timestamptz default now());
insert into product_defaults values
 (5,14,2,2,0.9,'tap',6,now()),(6,17,2,1,1.0,'tap',5,now()),(7,20,3,0,1.0,'tap_drag_exp',5,now());
alter table episodes add column if not exists cp_options_variants jsonb default '{}';  -- 노드별 2택 서브셋
```

## 5. API (v1.0 4종 + 1)

⑤ `GET /v1/children/{id}/session-config` → {age_band, defaults, holdout_arm, mood_preset} — 아이 앱 부트스트랩 1콜.

## 6. 통합 백로그 v1.1 (릴리즈별 · 상태: 유지/개정/신규)

R0 유지: E1-1~2, E2-1~3, E11-1 / 신규·개정: E13-1(아바타 발주)·E13-2(004+리듀서)·E13-10(안전 게이트)·**005 적용(E13-2에 포함)**·E12-1'(랜딩).

**R1 (W3–8)** — 유지: E1-3~6, E4-1~4, E5-1, E6 전체, E7 전체, E11-2, E12-2~3

| ID | 티켓 (AC 내장) | 오너 | 상태 |
|---|---|---|---|
| E13-3' | A0 아바타+**이름 3모드**: 추천 3택 우선 렌더·음성 재시도·초성 밴드 게이팅, 총 <90s, 무입력 기본 "단짝아" | DEV | 개정 |
| E13-4 | 호명 파이프(name_slot 갭리스+로컬 TTS, 외부 미전송 검증) | CC | 유지 |
| E13-5 | 사전조합 스틸 배치(144×slots, 실패 조합 폴백 지정, 에피당 <2h) | CC | 유지 |
| E13-6 | 책장 v1(A1/A5: path_taken 회고, "다르게 골라볼래" 재진입, replay_view 계측) | DEV | 유지 |
| E13-7' | **키오스크 데모 v2 = 2스텝**(단짝+색), 호명 "친구야", 이름 수집 코드 부재 테스트, 관 A/B 플래그 | DEV/CC | 개정 |
| E13-8 | 티어A on/off 50:50 배선+W4 대시보드 | CC | 유지 |
| **E13-15** | **CP0 연습 선택**: 오프닝 15s 내, 양택 동일 반응, 5세 리드 2회(6s/11s), passive_first_cp 계측 | DEV | 신규 |
| **E13-16** | **연령 기본값 시스템**: 005 스키마+session-config API+무언 적용+홀드아웃, 3밴드 E2E 검증 | CC | 신규 |
| **E13-17** | **이름 추천 풀 100** 큐레이션+금칙·발음 검사 파이프 | CC | 신규 |
| **E13-18** | A3 **탭 배치 전환**: 슬롯 펄스→후보 탭, 드래그는 7세 플래그 실험군만 | DEV | 신규 |
| **E15-1** | 아동 관찰 계측 7종: cp_timeout(리드 노출)·passive_first_cp·tap_miss(좌표)·assist_needed·replay_view·naming_mode_used·session_fatigue_exit — 전부 비식별 | CC | 신규 |
| **E15-2** | **Phase B 키트(W6–7)**: 과업 6 스크립트·행동 코딩 시트·동의(영상 미촬영)·합격선=시뮬 예측±10%p·결과→파라미터 v2→재시뮬 러너 | CC/CMO | 신규 |
| E5-2' | 신규 에피소드 주인공 포맷: avatar/companion_slots+**cp_options_variants(2택 서브셋 필수)**+재시청가치 태깅 | CC | 개정 |

**R2 (W9–12)** — 유지: E3 전체, E8 전체 / E13-9(world_state 주입+연속성), E13-11(티어B 워커·₩4,800 하드캡), E8-2'(단짝 반응 컷 — CP 전환 <300ms 예산 내).

**R3 (W13–16)** — 유지: E10 전체, E12-4 / E13-12(리캡), E13-13(생일 단품), E13-14(티어 판정 리포트).

**R4 (W17–24)** — E14-1(Kids 심사 패키지)·E14-2(형제 세계)·E14-3(POD)·E14-4(안정화·성능 예산 전항)·E14-5(데이터룸 자동화).

## 7. 테스트·품질 (v1.1)

골든테스트: 연속성 10 · 아바타 144 QC · **연령 기본값 3밴드 적용**(신규) · 스키마·금칙·분기 도달성 · **CP 2택 서브셋 유효성**(신규). E2E 3: ①키오스크→QR→온보딩→A0→입장여행→CP0→책장→리포트→결제 ②티어A 폴백 강제 무결 ③해지→30일 삭제. 성능 예산: 세션 시작<3s·CP 전환<300ms(단짝 컷 포함)·아바타 저장<1s·사전조합<2h/에피·이벤트 유실<0.1%. 안전 자동 게이트: 금칙어·주인공 문법·광과민·볼륨·실사유사·연속성 — 실패 시 published 불가. **Phase B 프로토콜은 플레이테스트 리포트 §6이 정본**(15–20명·과업 6·합격선 표) — 결과로 파라미터 교체→재시뮬→R1 Usability Gate 확정.

## 8. 운영·개발 규칙 (v1.0 유지 + 모니터링 추가)

trunk+플래그, dev/staging/prod(서울 고정), Secret Manager. CC 규칙: 티켓=작업지시, 사람 리뷰 머지, 테스트 없는 PR 금지, prod 시크릿·결제 코드 접근 금지. 모니터링 추가: passive_first_cp 추이·폴백률(>5% 경보)·tap_miss 핫스팟·session_fatigue_exit 분포(밴드 기본값 튜닝 입력).

## 9. 리스크·롤백 (v1.1)

v1.0 표 유지 + 신규 2: **Usability Gate 실측 미달**(예측 −10%p 초과) → 해당 화면 개정 스프린트 우선, 게이트 재심 전 다음 릴리즈 배포 보류 / **연령 기본값 오배정**(출생연월 오류) → 부모 웹에서 수정 가능, 배정 로그 감사.

## 부록 A. 연속성 골든테스트 10 (v1.0 동일 — 요지)

관계 모순·기한 스레드·아이템 모순·지명 모순·단짝 오기 = 반려 / 정상 회수·재등장·신규 도입·신규 가입 중립판·digest 폴백 = 통과.

**핸드오프 조건 불변** — 이 문서+기획서 v2.2+모델 v1.3을 읽은 개발자가 질문 없이 R0 첫 티켓을 시작할 수 있어야 하며, 막히면 문서를 고친다.
