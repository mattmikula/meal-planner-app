import type { ReactNode } from "react";
import { Fraunces, Space_Grotesk } from "next/font/google";

import "./globals.css";

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600", "700"]
});

const headingFont = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["400", "600", "700"]
});

export const metadata = {
  title: "Meal Planner",
  description: "Meal planning made simple."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${headingFont.variable}`}>{children}</body>
    </html>
  );
}
