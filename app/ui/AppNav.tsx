"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import styles from "./AppNav.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/planner", label: "Planner" },
  { href: "/meals", label: "Meals" },
  { href: "/ingredients", label: "Ingredients" },
  { href: "/groceries", label: "Groceries" },
  { href: "/household/invite", label: "Invite member" }
];

enum AccountStatusMessage {
  SignOutFailed = "Unable to sign out. Try again."
}

const isActivePath = (pathname: string, href: string) => {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname.startsWith(href);
};

function AccountMenu() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setStatus(null);
    const { error, response } = await api.POST("/api/logout");
    if (response?.ok) {
      setIsOpen(false);
      router.push("/");
      router.refresh();
      return;
    }
    setStatus(getApiErrorMessage(error) ?? AccountStatusMessage.SignOutFailed);
  };

  return (
    <div className={styles.account}>
      <button
        type="button"
        className={`${styles.link} ${styles.accountButton}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((prev) => !prev)}
        ref={buttonRef}
      >
        Account
      </button>
      <div
        id={menuId}
        className={styles.accountMenu}
        role="menu"
        aria-label="Account"
        hidden={!isOpen}
        ref={menuRef}
      >
        <button
          type="button"
          className={styles.accountItem}
          role="menuitem"
          onClick={handleLogout}
        >
          Sign Out
        </button>
        {status ? (
          <p className={styles.accountStatus} role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}

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
        <li>
          <AccountMenu />
        </li>
      </ul>
    </nav>
  );
}
