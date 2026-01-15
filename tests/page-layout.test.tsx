// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import PageLayout from "@/app/ui/PageLayout";
import styles from "@/app/ui/PageLayout.module.css";

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
