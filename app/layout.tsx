import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";

import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FinSight AI",
  description:
    "Schedule-aware cash forecast for Harbor & Co. Synthetic books, calculated scenarios, and a trailing-average baseline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
