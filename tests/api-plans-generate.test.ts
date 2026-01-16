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

const planMocks = vi.hoisted(() => ({
  generatePlanForWeek: vi.fn()
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

vi.mock("@/lib/plans/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/plans/server")>(
    "@/lib/plans/server"
  );
  return {
    ...actual,
    generatePlanForWeek: planMocks.generatePlanForWeek
  };
});

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { POST as generatePlan } from "@/app/api/plans/generate/route";
import { PlanGenerationError } from "@/lib/plans/server";

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

const samplePlanDays = Array.from({ length: 7 }, (_, index) => ({
  id: `plan-day-${index + 1}`,
  planId: "plan-1",
  date: `2024-02-${String(12 + index).padStart(2, "0")}`,
  mealId: null,
  locked: false,
  createdAt: "2024-02-10T09:00:00Z",
  createdBy: "user-1",
  updatedAt: null,
  updatedBy: null
}));

const samplePlan = {
  id: "plan-1",
  weekStart: "2024-02-12",
  createdAt: "2024-02-10T09:00:00Z",
  createdBy: "user-1",
  updatedAt: null,
  updatedBy: null,
  days: samplePlanDays
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/plans/generate", () => {
  it("returns unauthorized when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "2024-02-12" })
      })
    );

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: "invalid json"
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when weekStart is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(400);
  });

  it("returns plan when authenticated", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    planMocks.generatePlanForWeek.mockResolvedValue(samplePlan);

    const response = await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "2024-02-12" })
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(samplePlan);
  });

  it("returns 400 when plan generation fails with a known error", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.generatePlanForWeek.mockRejectedValue(
      new PlanGenerationError("No meals available to generate a plan.")
    );

    const response = await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "2024-02-12" })
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "No meals available to generate a plan."
    });
  });

  it("sets auth cookies when session exists", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.generatePlanForWeek.mockResolvedValue(samplePlan);

    await generatePlan(
      new Request("https://localhost/api/plans/generate", {
        method: "POST",
        body: JSON.stringify({ weekStart: "2024-02-12" })
      })
    );

    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
  });
});
