import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // GCP Cloud Run 배포: standalone 번들로 작은 런타임 이미지 생성.
  output: 'standalone',
  // dev: 127.0.0.1 로 접속 시 HMR/dev 리소스 cross-origin 차단 해제
  // (로컬 Supabase 콜백이 127.0.0.1 기준이라 앱도 127.0.0.1 로 접속함)
  allowedDevOrigins: ['127.0.0.1'],
};

export default nextConfig;
