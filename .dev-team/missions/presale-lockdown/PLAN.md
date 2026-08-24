# PLAN — presale-lockdown  (2026-08-04 중단 시점 상태)

목표: 8/31 실가 프리세일 전에 **DB 직접 조작 경로를 막고, 프리세일 밖 표면을 닫고,
표시가=청구가를 맞춘다.** 근거 = claudecodex.md Part II §C(G1).

## 상태: 7/9 머지, 대표 지시로 일시 중단

| 태스크 | 상태 | 커밋 | 요지 |
|---|---|---|---|
| next-patch | **merged** | 8fe58d2 | Next 16.2.12 — 미들웨어 우회 CVE 3건 해소 |
| route-closure | **merged** | bacb62a | 프리세일 5개 표면만 개방, 나머지 404 + noindex + OG |
| landing-price-claims | **merged** (try2) | 378a61c | 가격 단일 출처, 이름호명·48편 제거, 랜딩 정적화 |
| rls-lockdown | **merged** | d655af2 | `0030` — authenticated DML 전면 회수 + 페이월 차단 |
| payment-charge-guard | **merged** | f7103b7 | 청구 스킵 판정을 프로바이더 실조회로, fail-closed |
| rls-verify-matrix | **merged** (try2) | 4241d32 | 인증 세션 공격 31종 + positive control |
| env-hardfail | **merged** | f73d244 | 프로덕션에서 우회 플래그면 부팅 실패 |
| **deploy-env-lock** | **interrupted** | — | 배포 판별자 교체. **재개 필요 — 배포 차단 항목** |
| **test-wiring** | **TODO** | — | 고아 테스트를 `npm test`에 편입 |

## ⚠️ 배포 차단 (deploy-env-lock 머지 전까지)

**프리뷰·프로덕션 어느 쪽도 현재 HEAD로 배포하지 마라.**

판정 함수 `isProductionLaunchEnvironment`(`src/lib/launch-surface.ts`)가 `VERCEL_ENV`를 보는데
이 저장소는 Cloud Run 배포다(`cloudbuild.yaml`·`Dockerfile`·`scripts/deploy-cloud-run.sh`에 그 변수 없음).

1. 프리뷰가 부팅 실패한다 — 같은 도커 이미지(`NODE_ENV=production`) + `KINDY_LOCAL_PREVIEW=1`
   → 프로덕션 판정 → `instrumentation.ts` exit 1.
2. 역방향: 프로덕션에 `VERCEL_ENV=preview`가 들어가면 라우트 폐쇄·빌링키 암호화·게스트 모드 가드가
   **조용히 전부 꺼진다.**

## 재개 방법

```bash
bash ~/.claude/skills/dev-team/scripts/status.sh --recover   # 고아 워크트리 정리
bash ~/.claude/skills/dev-team/scripts/worker.sh presale-lockdown deploy-env-lock
# 머지 후
bash ~/.claude/skills/dev-team/scripts/worker.sh presale-lockdown test-wiring
```

## 사람 게이트 (워커 금지 — 대표 승인 필요)

1. **`0030` 마이그레이션 적용** — 스테이징 먼저, 트랜잭션 안에서. 아직 실 DB 실행 이력 0.
2. **`verify-rls.ts` 실행** — `0030` 적용 후. 이걸 통과해야 "네 구멍이 실제로 막혔다"가 증명된다.
   ```
   RLS_VERIFY_ENVIRONMENT=local \
   RLS_VERIFY_ALLOW_WRITES=I_ACKNOWLEDGE_THIS_IS_NOT_PRODUCTION \
   npx tsx --env-file=.env.local scripts/verify-rls.ts
   ```
3. **통신판매업 신고번호**(정부24) — 체크아웃 하드 차단 해제의 열쇠. 코드 아님, 임계경로 최상단.

## 후속 미션 (이번 범위 밖 — 대표 결정 기록됨)

- 환불 **14일 100% 유지** → 약관 §7·체크아웃 문구 정렬 (법무 검토 선행).
- 카톡 **채널 개설 전제** → 8/31 전 채널·알림톡 심사.
- 랜딩 클레임 교수·런던·비교표 **유지** 확정.
- 프리세일 일회성 결제 라우트 + **웹훅 금액·통화 검증**(현재 없음 — 클라이언트 개시 결제가 붙는
  순간 실제 취약점이 된다).
- 남은 API 계열 폐쇄(`/api/library`·`/api/game/events`·`/api/syllabus` 등).
- G2: 세션 루프 엔진 · 파일럿 4편 · 연령 7-9 정렬 · 리포트 정직화 · 성능.
