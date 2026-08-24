# r0-hero PLAN — 상태판 (재진입점)

원천: docs/plan/04_R0_EXECUTION_PLAN.md (그리드·Exit 정본) · 02(스키마 SSOT)

| id | 내용 (04 매핑) | effort | deps | 상태 |
|---|---|---|---|---|
| t1-bootstrap | Task 1: 이어받기·CI·원격(GenTA-AI/kindy-web-v2 private)·원본 보관 | high | — | **done** — approve(리뷰 파일). 샌드박스 제약 2건은 리드 ops로 마무리. main 보호는 무료플랜 403 → 프로세스 대체 |
| t2-migrations | Task 2.1: 0024–0029 SQL(02에서 그대로)+verify 확장 | medium | t1 | **merged** |
| t3-worldstate-reducer | Task 2.2: E13-2 리듀서+session-config+골든테스트 12+CI 확장 | xhigh | t2 | **merged** |
| t4-avatar-spec | Task 2.3: E13-1 아바타 144 스틸 스펙+샘플 3조합 | medium | t1 | **merged** |
| t5-no-camera-test | Task 2.4: E13-10 사진·카메라 코드 부재 정적 스캔 테스트 | medium | t1 | **merged** |
| t6-landing | Task 2.5: E12-1' 랜딩 카피(기획서 W1 실문구) | medium | t1 | **merged** |
| t7-sim-scripts | Task 2.6: 시뮬 3종 scripts/sim/ 이식+재현 검증 | medium | t1 | **merged** |

[사람] 게이트(워커 태스크 아님 — 04 Task 4.x): ~~Inngest Cloud 연결~~ **완료 2026-07-06**(sync 등록·cloud 모드 확인. function_count=1 — 구 이미지: v2 첫 배포 시 결제 갱신 cron 자동 등록, 이번 주 내 배포 권장[사람]) · ~~LoRA 생존 확인~~ **완료 2026-07-06**(로컬+Storage 이중 백업) · ~~Phase B 공문~~ **승인 2026-07-06** · DNS **진행중 2026-07-06**(Cloudflare NS 이전 신청, 24~48h 전파 대기) · Supertone(미착수) · ~~연구소 신고(4.8)~~ **R0 제외 2026-07-06**(시드투자 이후로 연기, 대표 결정) · 키오스크 발주(4.7, 미착수) · ~~supabase db push~~ **완료 2026-07-05**(0015 extensions 픽스 후 0015–0029 적용, verify-migrations 전항 ✓ — product_defaults 3행·model_registry 16행 확인. 부수: .env.local이 placeholder였음 → URL 교정+키 2개 대표 직접 주입. verify-rls는 실행 대기)

상세 기록: docs/plan/04_R0_EXECUTION_PLAN.md Task 4.1/4.2/4.4/4.6/4.8 + Exit 표 #1f·#12–#15 (2026-07-06 갱신)

E13-1 종결(2026-07-05): 스펙 프리즈 + 샘플 3장($0.117) 대표 승인 — Studio W3 키프레임 프리즈 입력 확보.

메모: t1은 non-git 시작이라 main-tree 실행(DEVTEAM_NO_WORKTREE=1, 리뷰 diff-blind — git log로 대체 검증). t1 머지 개념 없음(main 직작업, 문서화된 예외). t1 후 .dev-team/memory/invariants.md가 kindy-web 상속본으로 대체됨 → 리드가 미션 룰 병합 예정.

**t9-classic-canon 완료(2026-07-07)**: 고전 극장 라인 정본 개정 초안 06_CLASSIC_THEATER_LINE.md 신규(19KB) + BRAND_DNA·00·03 최소 델타 머지(6b39e43). 아기돼지 삼형제 파일럿 재매핑(배역: 꾸미·방울·도토=삼형제, 늑대=센바람 역할 순화, 모리=호스트 / CP1 재료선택·CP2 위기대응·CP3 결말분기 / C6 태깅) + 저작권 실무 6단계. **대표 최종 정본 승인 대기**.
