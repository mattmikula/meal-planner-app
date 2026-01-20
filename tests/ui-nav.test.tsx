// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

import AppNav from "@/app/ui/AppNav";
import styles from "@/app/ui/AppNav.module.css";

const mockUsePathname = vi.fn(() => null as string | null);

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => mockRouter
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockUsePathname.mockReset();
});

test("marks the active route in the nav", () => {
  mockUsePathname.mockReturnValue("/meals");
  render(<AppNav />);

  const mealsLink = screen.getByRole("link", { name: "Meals" });
  expect(mealsLink).toHaveClass(styles.linkActive);
  expect(mealsLink).toHaveAttribute("aria-current", "page");
});

test("marks the planner link active for the planner path", () => {
  mockUsePathname.mockReturnValue("/planner");
  render(<AppNav />);

  const plannerLink = screen.getByRole("link", { name: "Planner" });
  expect(plannerLink).toHaveClass(styles.linkActive);
  expect(plannerLink).toHaveAttribute("aria-current", "page");
});

test("marks the home link active for the root path", () => {
  mockUsePathname.mockReturnValue("/");
  render(<AppNav />);

  const homeLink = screen.getByRole("link", { name: "Home" });
  expect(homeLink).toHaveClass(styles.linkActive);
  expect(homeLink).toHaveAttribute("aria-current", "page");
});

test("does not set an active link when pathname is null", () => {
  mockUsePathname.mockReturnValue(null);
  render(<AppNav />);

  const links = screen.getAllByRole("link");
  links.forEach((link) => {
    expect(link).not.toHaveClass(styles.linkActive);
  });
});

test("does not mark unrelated paths as active", () => {
  mockUsePathname.mockReturnValue("/settings");
  render(<AppNav />);

  const links = screen.getAllByRole("link");
  links.forEach((link) => {
    expect(link).not.toHaveClass(styles.linkActive);
  });
});
