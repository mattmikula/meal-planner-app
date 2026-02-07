// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import IngredientSuggestionsClient from "@/app/ingredients/IngredientSuggestionsClient";

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn()
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter
}));

vi.mock("@/app/ui/AppNav", () => ({
  default: () => <nav>AppNav</nav>
}));

vi.mock("@/lib/api/client", () => ({
  createApiClient: () => ({
    GET: mockGet,
    POST: mockPost
  })
}));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockRouter.push.mockReset();
  mockRouter.replace.mockReset();
  mockRouter.refresh.mockReset();
});

test("does not preflight session when the page mounts", () => {
  render(<IngredientSuggestionsClient />);

  expect(mockGet).not.toHaveBeenCalled();
});

test("redirects to home when suggestion request returns unauthorized", async () => {
  mockPost.mockResolvedValue({
    data: undefined,
    error: undefined,
    response: { ok: false, status: 401 }
  });

  render(<IngredientSuggestionsClient />);
  fireEvent.change(screen.getByLabelText("Available Ingredients"), {
    target: { value: "chicken" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Suggest Meal" }));

  await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"));
});
