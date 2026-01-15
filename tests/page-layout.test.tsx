// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import PageLayout from "@/app/ui/PageLayout";
import styles from "@/app/ui/PageLayout.module.css";

afterEach(() => {
  cleanup();
});

test("renders the nav shell when nav content is provided", () => {
  render(
    <PageLayout title="Title" nav={<div>Nav content</div>}>
      <div>Body</div>
    </PageLayout>
  );

  const nav = screen.getByText("Nav content");
  expect(nav.parentElement).toHaveClass(styles.shellNav);
  expect(document.querySelector(`.${styles.shell}`)).not.toBeNull();
});

test("renders without shell styles when nav is omitted", () => {
  render(
    <PageLayout title="Title">
      <div>Body</div>
    </PageLayout>
  );

  const main = screen.getByRole("main");
  expect(document.querySelector(`.${styles.shell}`)).toBeNull();
  expect(main).not.toHaveClass(styles.shellMain);
});
