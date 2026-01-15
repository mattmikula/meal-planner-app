import type { ReactNode } from "react";

import styles from "./PageLayout.module.css";

type PageLayoutProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  size?: "narrow" | "wide";
};

export default function PageLayout({
  title,
  subtitle,
  actions,
  nav,
  children,
  size = "narrow"
}: PageLayoutProps) {
  const sizeClass = size === "wide" ? styles.pageWide : styles.pageNarrow;

  return (
    <div className={nav ? styles.shell : undefined}>
      {nav ? <aside className={styles.shellNav}>{nav}</aside> : null}
      <main
        className={[
          styles.page,
          sizeClass,
          nav ? styles.shellMain : undefined
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <header className={styles.pageHeader}>
          <div className={styles.pageTitle}>
            <h1>{title}</h1>
            {subtitle ? <p className={styles.pageSubtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className={styles.pageActions}>{actions}</div> : null}
        </header>
        <div className={styles.pageContent}>{children}</div>
      </main>
    </div>
  );
}
