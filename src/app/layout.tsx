import type { Metadata } from "next";
import SiteFooter from "@/components/SiteFooter";
import { pretendard } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kindy - 우리 아이 맞춤 학습 영상",
  description: "아이가 좋아하는 스타일로 만든 맞춤 교육 영상. 집중력이 달라집니다.",
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
