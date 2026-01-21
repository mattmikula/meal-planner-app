"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  { href: "/household", label: "Household" },
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
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const { response } = await api.GET("/api/me");
        if (isMounted) {
          setIsAuthenticated(Boolean(response?.ok));
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [api]);

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
      // Force full reload if already on home page to reset client state
      if (pathname === "/") {
        window.location.href = "/";
      } else {
        router.push("/");
        router.refresh();
      }
      return;
    }
    setStatus(getApiErrorMessage(error) ?? AccountStatusMessage.SignOutFailed);
  };

  if (!isAuthenticated) {
    return null;
  }

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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => {
    const hasMatchMedia =
      typeof window !== "undefined" && typeof window.matchMedia === "function";
    if (!hasMatchMedia) {
      return true;
    }
    return window.matchMedia("(min-width: 900px)").matches;
  });
  const menuId = useId();
  const isDesktopNav = isMounted && isDesktop;
  const menuOpen = isDesktopNav ? true : isMenuOpen;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const hasMatchMedia =
      typeof window !== "undefined" && typeof window.matchMedia === "function";
    if (!hasMatchMedia) {
      setIsDesktop(true);
      return;
    }

    const media = window.matchMedia("(min-width: 900px)");
    const updateMatch = () => setIsDesktop(media.matches);
    updateMatch();
    media.addEventListener("change", updateMatch);

    return () => {
      media.removeEventListener("change", updateMatch);
    };
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const navList = (
    <ul className={`${styles.list} ${styles.navList}`} id={menuId}>
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
  );

  return (
    <>
      <nav className={styles.nav} aria-label="Primary" data-menu-open={menuOpen}>
        <div className={styles.bar}>
          {!isDesktopNav ? (
            <button
              type="button"
              className={styles.menuButton}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label="Menu"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path
                  d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"
                  fill="currentColor"
                />
              </svg>
            </button>
          ) : null}
          <Link href="/" className={styles.brand}>
            Meal Planner
          </Link>
        </div>
        {isDesktopNav ? navList : null}
      </nav>
      {isMounted && !isDesktop && menuOpen
        ? createPortal(
            <button
              type="button"
              className={styles.scrim}
              aria-label="Close menu"
              onClick={() => setIsMenuOpen(false)}
            />,
            document.body
          )
        : null}
      {isMounted && !isDesktop
        ? createPortal(
            <div className={styles.drawer} aria-hidden={!menuOpen} data-open={menuOpen}>
              {navList}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
