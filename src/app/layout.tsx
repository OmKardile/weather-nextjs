import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const description =
  "A premium, weather-reactive forecast experience. Live conditions, 24-hour trends, 7-day outlook and air quality — beautifully rendered for every sky.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Aether — Weather, elevated.",
    template: "%s · Aether",
  },
  description,
  applicationName: "Aether",
  keywords: ["weather", "forecast", "rain", "air quality", "Aether", "Open-Meteo", "PWA"],
  authors: [{ name: "Aether" }],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Aether",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    siteName: "Aether",
    title: "Aether — Weather, elevated.",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aether — Weather, elevated.",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a2b2a" },
    { media: "(prefers-color-scheme: light)", color: "#9fdfd3" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sora.variable} ${inter.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
