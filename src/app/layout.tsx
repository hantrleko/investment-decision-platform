import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/layout/auth-provider";
import { TopNav } from "@/components/layout/top-nav";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eugene Finance",
  description: "Investment Decision Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Show the unread notification badge only when authenticated.
  let unreadCount = 0;
  try {
    const session = await auth();
    if (session?.user?.id) {
      unreadCount = await prisma.notification.count({ where: { readAt: null } });
    }
  } catch {
    // Non-fatal: badge simply shows 0 if the count query fails.
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>
          <TopNav unreadCount={unreadCount} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
