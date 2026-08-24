# env-hardfail: 프리뷰용 우회 환경변수가 프로덕션에서 켜지면 부팅 실패
effort: xhigh
high_risk: 1

## Goal

환경변수 하나가 잘못 새면 **저장된 카드 빌링키가 전부 평문이 되거나, 유료 레슨이 공개된다.**
지금은 그걸 막는 장치가 없다.

두 개의 우회 플래그가 있다.

- **`KINDY_LOCAL_PREVIEW=1`** — `src/lib/billing-crypto.ts`에서 `isProd()`를 false로 만든다.
  그 결과 `encryptBillingKey()`가 AES-256-GCM 대신 `plain:<billingKey>`를 저장한다.
  다른 사용처(`src/lib/auth.ts`, `src/proxy.ts`)는 Supabase가 미설정일 때만 이 플래그를 보는데,
  **암호화 경로는 완전히 설정된 프로덕션에서도 발동한다.** 조용히, 경고 없이.
- **`LESSON_GUEST_MODE=1`** — `src/app/lesson/[lessonId]/page.tsx`에서 로그인·아이 확인·멤버십
  게이트를 전부 건너뛰고 유료 영상의 서명 URL을 아무에게나 준다.

둘 다 프리뷰 배포용으로 만들어졌고, 유일한 보호 장치는 "그 환경에만 설정한다"는 사람의 약속이다.

이 태스크가 끝나면: 프로덕션에서 둘 중 하나라도 켜져 있으면 **앱이 뜨지 않는다.** 조용히 취약한
상태로 서비스하느니 배포가 실패하는 게 낫다.

## Scope
- `src/instrumentation.ts` NEW — Next의 부팅 훅
- `src/lib/env-guard.ts` NEW — 순수 판정 로직(테스트 가능하게 분리)
- `src/lib/billing-crypto.ts` isProd가 우회 플래그로 뒤집히지 않게
- `src/lib/env-guard.test.ts` NEW — 판정 로직 테스트
- `package.json` test 스크립트가 파일 목록이라 새 테스트 등록에 필요

## Constraints
- **코드를 쓰기 전에 `node_modules/next/dist/docs/`에서 `instrumentation` 가이드를 읽어라.**
  이 저장소의 Next 16은 훈련 데이터와 다르다. 파일 위치(`src/` 안인지 루트인지), export 이름
  (`register`), 실행 시점, 런타임 분기를 문서로 확인하고 그대로 따라라. 추측 금지.
- **하드페일이 로컬 개발과 프리뷰를 깨면 안 된다.** 판정은 "프로덕션인가"에 기반해야 하고,
  프로덕션 판정 자체가 우회 플래그의 영향을 받으면 안 된다(그게 지금 버그다).
  로컬(`npm run dev`)과 프리뷰 배포에서는 지금처럼 동작해야 한다.
- **`npm run build`가 깨지면 안 된다.** 빌드 타임에 instrumentation이 실행되는지 문서로 확인하고,
  빌드 중에 하드페일이 터지지 않게 하라. 이걸 잘못 짜면 CI와 배포가 통째로 멈춘다 — 이 태스크가
  xhigh인 이유다.
- **시크릿 값을 로그·에러 메시지에 넣지 마라.** 어떤 변수가 문제인지 **이름만** 말하라.
- `billing-crypto.ts`의 AES-256-GCM 구현 자체를 건드리지 마라. `isProd()` 판정만 고친다.
- 레거시 평문 행을 복호화 시 받아주는 동작(`plain:` 접두사 처리)을 지우지 마라 — 이미 저장된
  데이터가 있을 수 있다. 다만 그 경로가 발생하면 경고를 남기는 것은 좋다.
- 새 의존성 추가 금지.

## Deliverables

1. **`src/lib/env-guard.ts`** — 순수 함수. 입력은 환경변수 맵(process.env를 직접 읽지 말고 주입받게),
   출력은 위반 목록. 최소한:
   - 프로덕션인데 `KINDY_LOCAL_PREVIEW=1` → 위반
   - 프로덕션인데 `LESSON_GUEST_MODE=1` → 위반
   - 프로덕션인데 `BILLING_KEY_SECRET`이 없다 → 위반 (빌링키를 암호화할 수 없다)
   - 위반이 아닌 케이스도 명확히(로컬·프리뷰에서 플래그가 켜진 것은 정상)
2. **`src/instrumentation.ts`** — 부팅 시 위 판정을 실행하고, 위반이 있으면 **명확한 메시지와 함께
   프로세스를 죽인다.** 메시지에는 어떤 변수가 왜 문제인지와 해결 방법이 들어간다.
3. **`src/lib/billing-crypto.ts`의 `isProd()` 수정** — `KINDY_LOCAL_PREVIEW`가 프로덕션 판정을
   뒤집지 못하게 한다. 프로덕션이면 무조건 암호화한다.
4. **테스트** — `env-guard`의 모든 분기. `node:test` + `npx tsx --test`, 상대 import.
   기존 테스트 파일 패턴을 먼저 읽어라. `npm test`에 포함되어 실행되어야 한다.
5. 프리뷰 배포가 계속 동작하려면 무엇을 어떻게 설정해야 하는지 **핸드오프에 정확히** 적어라.
   (프리뷰는 `KINDY_LOCAL_PREVIEW=1`로 돌고 있다 — 이 변경이 프리뷰를 깨면 안 된다.)

## Validation

```bash
npm run lint
npx next typegen && npx tsc --noEmit
npm test
npm run build
```

`npm run build`가 통과하는 것이 이 태스크에서 특히 중요하다. 빌드 중 instrumentation이 돌면서
하드페일이 터지면 배포가 불가능해진다.

## Handoff requirements

최종 메시지 끝에: summary, files_changed, validation(명령어 + **실제 출력**, build 성공 증거 필수),
risks, handoff_note.

`handoff_note`에 반드시:
- `node_modules/next/dist/docs/`에서 확인한 instrumentation의 **정확한 규약**(파일 위치·export·실행 시점)
  과 그 근거 문서 경로. 추측했으면 추측이라고 적어라.
- 로컬 / 프리뷰 / 프로덕션 각각에서 무슨 일이 벌어지는지 한 줄씩.
- **프리뷰 배포를 깨지 않으려면 리드가 무엇을 확인해야 하는가.**
- 빌드 타임에 instrumentation이 실행되는지 여부와, 그걸 어떻게 처리했는가.
- 하드페일이 터졌을 때 운영자가 보게 되는 메시지 전문.
