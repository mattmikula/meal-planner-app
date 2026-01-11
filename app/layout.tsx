import type { ReactNode } from "react";

export const metadata = {
  title: "Meal Planner",
  description: "Meal planning made simple."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
