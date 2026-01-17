import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://cdn.redoc.ly" />
      <link rel="dns-prefetch" href="https://cdn.redoc.ly" />
      {children}
    </>
  );
}
