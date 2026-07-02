# syntax=docker/dockerfile:1.7
# Kindy — GCP Cloud Run (Seoul) 용 프로덕션 이미지.
#
# 3-stage build:
#   1) deps  — npm ci (production + dev for build)
#   2) build — next build → .next/standalone
#   3) run   — 최소 런타임 (standalone 서버 + ffmpeg/ffprobe)
#
# ffmpeg/ffprobe 는 video-pipeline 의 concat 단계 및 last-frame 추출에 사용.
#
# 빌드:  docker build -t gcr.io/$PROJECT/kindy:latest \
#          --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#          --build-arg NEXT_PUBLIC_TOSS_CLIENT_KEY=... --build-arg NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME=... \
#          (BIZ 6종 전체 — 빠지면 결제 CTA가 "결제 준비 중"으로 잠김, 아래 ARG 목록 참조) .
# 테스트: docker run -p 8080:8080 --env-file .env.local gcr.io/$PROJECT/kindy:latest
#        (주의: NEXT_PUBLIC_* 는 빌드 타임 인라인 — --env-file 로는 결제 버튼이 안 열린다)
# 배포:  gcloud run deploy kindy --image=gcr.io/$PROJECT/kindy:latest --region=asia-northeast3 --allow-unauthenticated

# ═══════════════════════════════════════════════════════
# Stage 1: dependencies
# ═══════════════════════════════════════════════════════
FROM node:20-alpine AS deps
WORKDIR /app

# Corepack for pnpm/yarn (we use npm, but keep enabled for flexibility)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ═══════════════════════════════════════════════════════
# Stage 2: build
# ═══════════════════════════════════════════════════════
FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env: Next.js 는 NEXT_PUBLIC_* 를 bundle 에 박음. Secret Manager 로
# 런타임 주입할 수 없는 값들만 여기에 ARG 로 받는다 (공개값이므로 OK).
# 주의: 클라이언트 컴포넌트가 참조하는 NEXT_PUBLIC_* 는 빌드 시점에 없으면
# 번들에 빈 값이 박제된다 — 특히 TOSS 클라이언트 키와 BIZ 6종이 빠지면
# 결제 CTA 가 "결제 준비 중"으로 영구 비활성 (docs/07 P0-2).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_TOSS_CLIENT_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME
ARG NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER
ARG NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER
ARG NEXT_PUBLIC_BIZ_ADDRESS
ARG NEXT_PUBLIC_BIZ_PHONE
ARG NEXT_PUBLIC_BIZ_EMAIL
ARG NEXT_PUBLIC_KINDY_START_BASE
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_TOSS_CLIENT_KEY=$NEXT_PUBLIC_TOSS_CLIENT_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME=$NEXT_PUBLIC_BIZ_REPRESENTATIVE_NAME \
    NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER=$NEXT_PUBLIC_BIZ_REGISTRATION_NUMBER \
    NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER=$NEXT_PUBLIC_BIZ_MAIL_ORDER_NUMBER \
    NEXT_PUBLIC_BIZ_ADDRESS=$NEXT_PUBLIC_BIZ_ADDRESS \
    NEXT_PUBLIC_BIZ_PHONE=$NEXT_PUBLIC_BIZ_PHONE \
    NEXT_PUBLIC_BIZ_EMAIL=$NEXT_PUBLIC_BIZ_EMAIL \
    NEXT_PUBLIC_KINDY_START_BASE=$NEXT_PUBLIC_KINDY_START_BASE \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ═══════════════════════════════════════════════════════
# Stage 3: runtime
# ═══════════════════════════════════════════════════════
FROM node:20-alpine AS runtime
WORKDIR /app

# ffmpeg/ffprobe — video concat + keyframe 추출.
# tini — PID 1 signal handling (Cloud Run SIGTERM 에 graceful shutdown).
RUN apk add --no-cache ffmpeg tini && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Standalone 번들: 최소 node_modules 만 포함. static + public 은 별도 copy.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
