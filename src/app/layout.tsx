import type { Metadata } from "next";

import { Sidebar } from "@/components/sidebar";
import { QuizConfigProvider } from "@/lib/quiz-config";
import { QuizSessionProvider } from "@/lib/quiz-session";

import "./globals.css";

export const metadata: Metadata = {
  title: "Kana quiz",
  description: "Hiragana and katakana drill, match, and grid quizzes",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QuizConfigProvider>
          <QuizSessionProvider>
            <div className="mx-auto flex max-w-[1080px] gap-3.5 px-3 pb-15 pt-6">
              <Sidebar />
              <main className="min-w-0 flex-1">{children}</main>
            </div>
          </QuizSessionProvider>
        </QuizConfigProvider>
      </body>
    </html>
  );
}
