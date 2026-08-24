import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import { pretendard } from "./fonts";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kindy.kr";
const title = "Kindy — 명화·클래식·고전으로 만나는 통합 인문 수업";
const description =
  "명화와 클래식, 고전 이야기를 인문·정서·창의·독서로 연결하는 우리 아이 맞춤 통합 인문 수업. 매주 카톡으로 도착합니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "Kindy",
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Kindy",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/landing/seurat-poster.jpg",
        width: 1280,
        height: 720,
        alt: "쇠라의 명화로 시작하는 Kindy 통합 인문 수업",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/landing/seurat-poster.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full antialiased ${pretendard.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
