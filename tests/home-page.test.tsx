// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import HomePage from "@/app/page";

const mockGet = vi.fn();
const mockSignInWithOtp = vi.fn();

vi.mock("@/app/ui/AppNav", () => ({
  default: () => <nav>AppNav</nav>
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: () => ({
    GET: mockGet,
    POST: vi.fn()
  })
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      signInWithOtp: mockSignInWithOtp
    }
  })
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockGet.mockReset();
  mockSignInWithOtp.mockReset();
});

test("keeps nav hidden while session check is loading", () => {
  mockGet.mockReturnValue(new Promise(() => {}));
  render(<HomePage />);

  expect(screen.getByText("Loading…")).toBeInTheDocument();
  expect(screen.queryByText("AppNav")).not.toBeInTheDocument();
});

test("shows nav after loading an authenticated session", async () => {
  mockGet.mockResolvedValue({
    data: { email: "user@example.com" },
    response: { ok: true, status: 200 }
  });
  render(<HomePage />);

  await waitFor(() => expect(screen.getByText("AppNav")).toBeInTheDocument());
});
