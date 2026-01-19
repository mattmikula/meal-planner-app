"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./AppNav.module.css";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/planner", label: "Planner" },
  { href: "/meals", label: "Meals" },
  { href: "/groceries", label: "Groceries" },
  { href: "/household/invite", label: "Invite member" }
];

const isActivePath = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
};

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary">
      <Link href="/" className={styles.brand}>
        Meal Planner
      </Link>
      <ul className={styles.list}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname ? isActivePath(pathname, item.href) : false;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.link}${isActive ? ` ${styles.linkActive}` : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
