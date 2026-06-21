import type { Metadata } from "next";
import "./globals.css";

const title = "Untangle | 해야 할 일은 아는데, 시작이 안 될 때";
const description =
  "지금 할 1개를 대신 골라주지 않아요. 머릿속을 함께 정리하고, 당신이 고른 일을 지금 붙을 수 있는 첫 행동으로 쪼개줘요. ADHD를 위한 실행 파트너 Untangle.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Root layout applies to every route, so the font loads site-wide. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
