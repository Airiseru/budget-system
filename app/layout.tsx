import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import GeneralNavBar from "@/components/ui/GeneralNavBar";
import GlobalFloatingUserInfo from "@/components/ui/GlobalFloatingUserInfo";
import GlobalWelcomeStatus from "@/components/ui/GlobalWelcomeStatus";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Budget System",
  description: "Prototype implementation of the digitized and transparent budget system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={notoSans.className} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>
          <GeneralNavBar />
          {children}
          <GlobalWelcomeStatus />
          <GlobalFloatingUserInfo />
        </ThemeProvider>
      </body>
    </html>
  );
}
