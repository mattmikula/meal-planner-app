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
  updatePlanDay: vi.fn()
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
    updatePlanDay: planMocks.updatePlanDay
  };
});

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { PATCH as patchPlanDay } from "@/app/api/plans/days/[id]/route";
import { PlanMutationError } from "@/lib/plans/server";

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

const planDayId = "33333333-3333-4333-8333-333333333333";

const samplePlanDay = {
  id: planDayId,
  planId: "44444444-4444-4444-8444-444444444444",
  date: "2024-02-12",
  mealId: "55555555-5555-4555-8555-555555555555",
  leftoverFromPlanDayId: null,
  locked: true,
  createdAt: "2024-02-10T09:00:00Z",
  createdBy: "user-1",
  updatedAt: "2024-02-18T01:20:00Z",
  updatedBy: "user-1"
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/plans/days/[id]", () => {
  it("returns 400 when plan day id is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await patchPlanDay(
      new Request("https://localhost/api/plans/days/not-a-uuid", {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: "not-a-uuid" } }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Plan day ID must be a valid UUID." });
  });

  it("returns unauthorized when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: planDayId } }
    );

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns 400 when body is invalid JSON", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: "invalid json"
      }),
      { params: { id: planDayId } }
    );

    expect(response.status).toBe(400);
  });

  it("returns 400 when no fields are provided", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({})
      }),
      { params: { id: planDayId } }
    );

    expect(await response.json()).toEqual({
      error: "At least one field (mealId, locked, or leftoverFromPlanDayId) must be provided."
    });
  });

  it("returns 404 when plan day is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.updatePlanDay.mockResolvedValue(null);

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: planDayId } }
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when meal is not found", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.updatePlanDay.mockRejectedValue(new PlanMutationError("Meal not found.", 404));

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ mealId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" })
      }),
      { params: { id: planDayId } }
    );

    expect(response.status).toBe(404);
  });

  it("returns the updated plan day when authenticated", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.updatePlanDay.mockResolvedValue(samplePlanDay);

    const response = await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: planDayId } }
    );

    expect(await response.json()).toEqual(samplePlanDay);
  });

  it("calls updatePlanDay with household context", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    planMocks.updatePlanDay.mockResolvedValue(samplePlanDay);

    await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: planDayId } }
    );

    expect(planMocks.updatePlanDay).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      planDayId,
      { locked: true }
    );
  });

  it("sets auth cookies when session exists", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    planMocks.updatePlanDay.mockResolvedValue(samplePlanDay);

    await patchPlanDay(
      new Request(`https://localhost/api/plans/days/${planDayId}`, {
        method: "PATCH",
        body: JSON.stringify({ locked: true })
      }),
      { params: { id: planDayId } }
    );

    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
  });
});
