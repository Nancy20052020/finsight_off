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
  title: "FinSight",
  description:
    "Schedule-aware cash forecast for a small business. Upload a bank CSV, see the shortfall date, and move one assumption.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
