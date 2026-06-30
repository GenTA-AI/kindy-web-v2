# Kindy Web

Kindy는 만 3-8세 아이가 이야기 영상과 짧은 놀이를 통해 사고력, 표현력, 문제해결, 자기주도 활동을 경험하고, 부모는 점수나 또래 비교 없이 관찰 가능한 활동 기록과 대화 힌트를 받는 AI 기반 어린이 학습 서비스입니다.

서비스 전체를 빠르게 이해하려면 먼저 [docs/SERVICE_OVERVIEW.md](docs/SERVICE_OVERVIEW.md)를 읽어주세요. 현재 코드 기준의 제품 플로우, 라우트, API, 데이터 모델, 결제, 키오스크, AI 영상 파이프라인, 남은 리스크를 한 문서에 정리했습니다.

## 핵심 문서

| 목적 | 문서 |
|---|---|
| 서비스 전체 이해 | [docs/SERVICE_OVERVIEW.md](docs/SERVICE_OVERVIEW.md) |
| 런치 결정 | [docs/03_LAUNCH_FOUNDATION_LOCK.md](docs/03_LAUNCH_FOUNDATION_LOCK.md) |
| 랜딩/광고 카피 | [docs/04_LAUNCH_COPY.md](docs/04_LAUNCH_COPY.md) |
| 법적 리스크 | [docs/05_LEGAL_RISK.md](docs/05_LEGAL_RISK.md) |
| 디자인 토큰 | [DESIGN.md](DESIGN.md) |
| 실수 방지 | [docs/LESSONS.md](docs/LESSONS.md) |

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

AI 영상 생성, 결제, Supabase 인증은 `.env.local` 설정이 필요합니다. 예시는 [.env.local.example](.env.local.example)에 있습니다.

## 주요 스택

- Next.js 16, React 19, TypeScript
- Supabase Auth, Postgres, Storage
- Inngest
- TossPayments v2 billing
- Anthropic Claude, Google Gemini/Nano Banana, fal.ai, Seedance
- GCP Cloud Run, Cloud Build
