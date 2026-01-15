// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { ReactNode } from "react";
import React from "react";

import AppNav from "@/app/ui/AppNav";
import styles from "@/app/ui/AppNav.module.css";

const mockUsePathname = vi.fn(() => null as string | null);

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname()
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
