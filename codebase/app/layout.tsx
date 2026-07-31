import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VLearn Event AI — Trợ lý sự kiện",
  description:
    "Prototype CP3 dùng AI để hiểu câu hỏi, tìm kiếm và giải thích sự kiện VLearn từ dữ liệu minh hoạ.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "VLearn Event AI — Trợ lý sự kiện",
    description: "Hỏi sự kiện, theo dõi deadline và nhận nhắc lịch chủ động.",
    images: [{ url: "/og.png", width: 1680, height: 945 }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
