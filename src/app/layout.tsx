import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DesktopHeader } from "@/components/layout/DesktopHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { FeedbackModal } from "@/components/feedback/FeedbackModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true
};

export const metadata: Metadata = {
  title: "APL",
  description: "Premier League prediction competition",
  keywords: ["Premier League", "football", "predictions", "betting", "APL"],
  authors: [{ name: "APL" }],
  creator: "APL",
  publisher: "APL",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: {
    title: "APL - APL",
    description: "The ultimate Premier League prediction competition. Lets crown the next king or queen of the APL!",
    url: '/',
    siteName: 'APL',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/header_apl_medpil-01-01.png',
        width: 1200,
        height: 630,
        alt: 'APL - The ultimate Premier League prediction competition',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "APL - APL",
    description: "The ultimate Premier League prediction competition. Lets crown the next king or queen of the APL!",
    images: ['/header_apl_medpil-01-01.png'],
  },
  other: {
    'theme-color': '#0d9488', // Teal-600 for dark theme
    'color-scheme': 'dark light',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
            /* Only prevent white flash on body background in dark mode */
            html.dark, html.dark body { 
              background-color: #1a1a1a !important; 
            }
            /* Ensure light mode works properly */
            html:not(.dark), html:not(.dark) body {
              background-color: #ffffff !important;
            }
          `
        }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <DesktopHeader />
          <Toaster />
          <main className="pt-16 md:pt-16 pb-16 md:pb-0">
            {children}
          </main>
          <MobileBottomNav />
          <FeedbackModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
