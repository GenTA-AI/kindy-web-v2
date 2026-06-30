import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import { pretendard } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kindy Mori - 모리의 이야기 숲",
  description: "모리 영상을 보고 짧은 질문과 놀이를 마치면, 보호자가 오늘의 놀이 기록과 다음 추천을 확인하는 웹 서비스.",
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
