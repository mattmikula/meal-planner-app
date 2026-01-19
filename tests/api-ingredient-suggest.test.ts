import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => ({
  ensureHouseholdContext: vi.fn()
}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

const ingredientMocks = vi.hoisted(() => ({
  suggestMealFromIngredients: vi.fn()
}));

vi.mock("@/lib/auth/server", () => authMocks);

vi.mock("@/lib/household/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/household/server")>(
    "@/lib/household/server"
  );
  return {
    ...actual,
    ensureHouseholdContext: householdMocks.ensureHouseholdContext
  };
});

vi.mock("@/lib/supabase/server", () => supabaseMocks);

vi.mock("@/lib/ingredients/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ingredients/server")>(
    "@/lib/ingredients/server"
  );
  return {
    ...actual,
    ...ingredientMocks
  };
});

import { POST as suggestIngredients } from "@/app/api/ingredients/suggest/route";
import { IngredientSuggestionError } from "@/lib/ingredients/server";

const householdContext = {
  household: {
    id: "household-1",
    name: "Home",
    createdAt: "2024-02-12T10:00:00Z"
  },
  membership: {
    id: "member-1",
    householdId: "household-1",
    userId: "user-1",
    role: "owner",
    status: "active",
    createdAt: "2024-02-12T10:00:00Z"
  }
};

const sampleSuggestion = {
  mealId: "11111111-1111-4111-8111-111111111111",
  name: "Tacos",
  matchedIngredients: ["chicken", "lime"]
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ingredients/suggest", () => {
  it("returns unauthorized when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await suggestIngredients(
      new Request("https://localhost/api/ingredients/suggest", {
        method: "POST",
        body: JSON.stringify({ ingredients: ["chicken"] })
      })
    );

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await suggestIngredients(
      new Request("https://localhost/api/ingredients/suggest", {
        method: "POST",
        body: "invalid json"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when ingredients are missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await suggestIngredients(
      new Request("https://localhost/api/ingredients/suggest", {
        method: "POST",
        body: JSON.stringify({ ingredients: [] })
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when no meals match", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    ingredientMocks.suggestMealFromIngredients.mockRejectedValue(
      new IngredientSuggestionError("No matching meals found.", 404)
    );

    const response = await suggestIngredients(
      new Request("https://localhost/api/ingredients/suggest", {
        method: "POST",
        body: JSON.stringify({ ingredients: ["chicken"] })
      })
    );

    expect(response.status).toBe(404);
  });

  it("returns suggestion when successful", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    ingredientMocks.suggestMealFromIngredients.mockResolvedValue(sampleSuggestion);

    const response = await suggestIngredients(
      new Request("https://localhost/api/ingredients/suggest", {
        method: "POST",
        body: JSON.stringify({ ingredients: ["chicken"] })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sampleSuggestion);
  });
});
