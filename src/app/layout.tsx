import type { Metadata } from "next";
import "./globals.css";
import AuthListener from "@/components/auth/AuthListener";
import NicknameGate from "@/components/auth/NicknameGate";

export const metadata: Metadata = {
  title: "my text dungeon",
  description:
    "AI와 함께 던전을 만들고, 다른 유저의 던전에 도전하는 텍스트 로그라이트 RPG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className="font-sans bg-background text-text-main antialiased"
      >
        {children}
        <AuthListener />
        <NicknameGate />
      </body>
    </html>
  );
}
