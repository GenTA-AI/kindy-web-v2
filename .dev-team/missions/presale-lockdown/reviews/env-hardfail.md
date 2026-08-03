# review: env-hardfail
decision: approve

## 태스크 목표: 달성

- `src/lib/env-guard.ts` — 순수 함수, `process.env`를 직접 안 읽고 주입받는다. 위반 3종
  (`KINDY_LOCAL_PREVIEW=1` · `LESSON_GUEST_MODE=1` · `BILLING_KEY_SECRET` 부재)을 이유·해결법과 함께 반환.
- `src/instrumentation.ts` — Node 런타임은 `process.exit(1)`, Edge는 예외. 메시지에 **시크릿 값 없음**,
  변수 이름과 조치만.
- `src/lib/billing-crypto.ts` — `isProd()`가 `isProductionEnvironment()`로 교체돼
  **`KINDY_LOCAL_PREVIEW`가 더 이상 프로덕션 판정을 뒤집지 못한다.** AES-GCM 구현과 `plain:` 레거시
  복호화는 안 건드림 — 지시 준수.
- `env-guard.test.ts`가 `package.json`에 등록돼 실제로 돈다.

## 가장 위험했던 지점 — 빌드를 깨지 않았는가: 통과

워커가 **문서와 설치된 구현 양쪽**을 읽고 확인했다(추측 아님):
- `node_modules/next/dist/docs/.../instrumentation.md` — `src/` 사용 시 `src/instrumentation.ts`,
  `register` export, 서버 인스턴스당 1회, 요청 준비 전 완료.
- `next/dist/esm/server/lib/router-utils/instrumentation-globals.external.js:21`과
  `server/web/globals.js:6` — **`NEXT_PHASE === 'phase-production-build'`이면 `register`를 호출하지 않는다.**
가드를 모듈 최상단이 아니라 `register()` 안에 둔 것도 맞다. `npm run build` 55페이지 통과.

## 런타임 실검증
- 위험한 프로덕션 설정 → standalone 서버가 전체 메시지 출력 후 **exit 1**.
- `VERCEL_ENV=preview` + 두 우회 플래그 → `✓ Ready`, `/robots.txt` 200.

## critical
없음 — 태스크 범위 안에서는.

## 후속 태스크로 분리 (`deploy-env-lock`)

워커가 risks에 **정직하게 먼저 신고한** 문제이고, 근원은 이 태스크가 아니라 앞서 머지한
`route-closure`의 `isProductionLaunchEnvironment`다:

```ts
if (environment.VERCEL_ENV !== undefined) return environment.VERCEL_ENV === 'production';
return environment.NODE_ENV === 'production';
```

**이 저장소는 Vercel이 아니라 Cloud Run에 배포된다.** 리드 확인 결과 `cloudbuild.yaml`·`Dockerfile`·
`scripts/deploy-cloud-run.sh` 어디에도 `VERCEL_ENV`가 없다. 결과:

1. **프리뷰가 다음 배포에서 부팅 실패한다.** 프리뷰 서비스는 같은 도커 이미지(`NODE_ENV=production`)로
   돌면서 `KINDY_LOCAL_PREVIEW=1`을 쓴다 → 프로덕션으로 판정 → exit 1.
   (워커가 이걸 정확히 예고했다: "리드는 프리뷰 서비스에 `VERCEL_ENV=preview`가 있는지 확인해야 한다".)
2. **더 나쁜 역방향**: 프로덕션 서비스에 실수로 `VERCEL_ENV=preview`가 들어가면
   라우트 폐쇄가 풀리고, 빌링키 평문 저장이 허용되고, 게스트 레슨 모드가 열린다. **조용히.**
   오설정을 막으려고 만든 가드가 오설정 하나로 통째로 꺼진다.

이건 env-hardfail의 결함이 아니라 판별자 선택의 문제이므로 별도 태스크로 분리한다.
env-hardfail 자체는 요구한 것을 정확히 구현했고 빌드 안전성도 증명했다.

## 배포 전 필수 (사람 게이트)
`deploy-env-lock` 머지 전까지는 **프리뷰·프로덕션 어느 쪽도 이 코드로 배포하지 마라.**
프리뷰가 뜨지 않는다.
