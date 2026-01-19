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

const mealsMocks = vi.hoisted(() => ({
  listMeals: vi.fn(),
  createMeal: vi.fn(),
  fetchMeal: vi.fn(),
  updateMeal: vi.fn(),
  deleteMeal: vi.fn(),
  createMealSchema: {
    parse: vi.fn()
  },
  updateMealSchema: {
    parse: vi.fn()
  }
}));

vi.mock("@/lib/auth/server", () => authMocks);
vi.mock("@/lib/household/server", () => householdMocks);
vi.mock("@/lib/supabase/server", () => supabaseMocks);
vi.mock("@/lib/meals/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/meals/server")>(
    "@/lib/meals/server"
  );
  return {
    ...actual,
    ...mealsMocks
  };
});

import { GET as getMeals, POST as createMealRoute } from "@/app/api/meals/route";
import { PATCH as updateMealRoute, DELETE as deleteMealRoute } from "@/app/api/meals/[id]/route";

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

const authSession = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600
};

const mealId = "11111111-1111-4111-8111-111111111111";
const missingMealId = "22222222-2222-4222-8222-222222222222";

const sampleMeal = {
  id: mealId,
  name: "Spaghetti",
  notes: "Family favorite",
  imageUrl: null,
  ingredients: [],
  createdAt: "2024-02-12T10:00:00Z",
  createdBy: "user-1",
  updatedAt: null,
  updatedBy: null
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/meals", () => {
  it("returns unauthorized when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await getMeals(new Request("https://localhost/api/meals"));

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns meals list when authenticated", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    mealsMocks.listMeals.mockResolvedValue([sampleMeal]);

    const response = await getMeals(new Request("https://localhost/api/meals"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ meals: [sampleMeal] });
  });

  it("sets auth cookies when session exists", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    mealsMocks.listMeals.mockResolvedValue([]);

    await getMeals(new Request("https://localhost/api/meals"));

    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
  });

  it("calls listMeals with household ID", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.listMeals.mockResolvedValue([]);

    await getMeals(new Request("https://localhost/api/meals"));

    expect(mealsMocks.listMeals).toHaveBeenCalledWith(supabase, "household-1");
  });
});

describe("POST /api/meals", () => {
  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await createMealRoute(
      new Request("https://localhost/api/meals", {
        method: "POST",
        body: "invalid json"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns validation error when schema validation fails", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    mealsMocks.createMealSchema.parse.mockImplementation(() => {
      throw new Error("Name is required");
    });

    const response = await createMealRoute(
      new Request("https://localhost/api/meals", {
        method: "POST",
        body: JSON.stringify({ name: "" })
      })
    );

    expect(response.status).toBe(400);
  });

  it("creates meal with valid input", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.createMealSchema.parse.mockReturnValue({ name: "Tacos", notes: "Tuesday night" });
    mealsMocks.createMeal.mockResolvedValue(sampleMeal);

    const response = await createMealRoute(
      new Request("https://localhost/api/meals", {
        method: "POST",
        body: JSON.stringify({ name: "Tacos", notes: "Tuesday night" })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(sampleMeal);
    expect(mealsMocks.createMeal).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      { name: "Tacos", notes: "Tuesday night" }
    );
  });

  it("creates meal with ingredients", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.createMealSchema.parse.mockReturnValue({
      name: "Tacos",
      ingredients: ["chicken"]
    });
    mealsMocks.createMeal.mockResolvedValue(sampleMeal);

    const response = await createMealRoute(
      new Request("https://localhost/api/meals", {
        method: "POST",
        body: JSON.stringify({ name: "Tacos", ingredients: ["chicken"] })
      })
    );

    expect(response.status).toBe(200);
    expect(mealsMocks.createMeal).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      { name: "Tacos", ingredients: ["chicken"] }
    );
  });
});

describe("PATCH /api/meals/[id]", () => {
  it("returns 400 when meal id is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await updateMealRoute(
      new Request("https://localhost/api/meals/not-a-uuid", {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" })
      }),
      { params: { id: "not-a-uuid" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Meal ID must be a valid UUID." });
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const response = await updateMealRoute(
      new Request(`https://localhost/api/meals/${mealId}`, {
        method: "PATCH",
        body: "invalid json"
      }),
      { params: { id: mealId } }
    );

    expect(response.status).toBe(400);
  });

  it("returns validation error when schema validation fails", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    mealsMocks.updateMealSchema.parse.mockImplementation(() => {
      throw new Error("At least one field must be provided");
    });

    const response = await updateMealRoute(
      new Request(`https://localhost/api/meals/${mealId}`, {
        method: "PATCH",
        body: JSON.stringify({})
      }),
      { params: { id: mealId } }
    );

    expect(response.status).toBe(400);
  });

  it("returns 404 when meal not found", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.updateMealSchema.parse.mockReturnValue({ name: "Updated" });
    mealsMocks.updateMeal.mockResolvedValue(null);

    const response = await updateMealRoute(
      new Request(`https://localhost/api/meals/${missingMealId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated" })
      }),
      { params: { id: missingMealId } }
    );

    expect(response.status).toBe(404);
  });

  it("updates meal with valid input", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    const updatedMeal = { ...sampleMeal, name: "Updated Spaghetti" };
    mealsMocks.updateMealSchema.parse.mockReturnValue({ name: "Updated Spaghetti" });
    mealsMocks.updateMeal.mockResolvedValue(updatedMeal);

    const response = await updateMealRoute(
      new Request(`https://localhost/api/meals/${mealId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Spaghetti" })
      }),
      { params: { id: mealId } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updatedMeal);
    expect(mealsMocks.updateMeal).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      mealId,
      { name: "Updated Spaghetti" }
    );
  });

  it("updates meal with ingredients", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    const updatedMeal = { ...sampleMeal, ingredients: ["chicken"] };
    mealsMocks.updateMealSchema.parse.mockReturnValue({ ingredients: ["chicken"] });
    mealsMocks.updateMeal.mockResolvedValue(updatedMeal);

    const response = await updateMealRoute(
      new Request(`https://localhost/api/meals/${mealId}`, {
        method: "PATCH",
        body: JSON.stringify({ ingredients: ["chicken"] })
      }),
      { params: { id: mealId } }
    );

    expect(response.status).toBe(200);
    expect(mealsMocks.updateMeal).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      mealId,
      { ingredients: ["chicken"] }
    );
  });
});

describe("DELETE /api/meals/[id]", () => {
  it("returns 400 when meal id is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await deleteMealRoute(
      new Request("https://localhost/api/meals/not-a-uuid", {
        method: "DELETE"
      }),
      { params: { id: "not-a-uuid" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Meal ID must be a valid UUID." });
  });

  it("returns 404 when meal not found", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.deleteMeal.mockResolvedValue(false);

    const response = await deleteMealRoute(
      new Request(`https://localhost/api/meals/${missingMealId}`, {
        method: "DELETE"
      }),
      { params: { id: missingMealId } }
    );

    expect(response.status).toBe(404);
  });

  it("deletes meal successfully", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    mealsMocks.deleteMeal.mockResolvedValue(true);

    const response = await deleteMealRoute(
      new Request(`https://localhost/api/meals/${mealId}`, {
        method: "DELETE"
      }),
      { params: { id: mealId } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mealsMocks.deleteMeal).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      mealId
    );
  });
});
