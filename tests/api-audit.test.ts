import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQuery } from "@/tests/supabase-mock";

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

vi.mock("@/lib/auth/server", () => authMocks);

vi.mock("@/lib/household/server", () => householdMocks);

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { GET as getAudit } from "@/app/api/audit/route";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/audit", () => {
  const setupAuditResponse = async (options: { url: string; data: unknown }) => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const query = createQuery({
      data: options.data,
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(query)
    });

    const response = await getAudit(new Request(options.url));

    return { response, query };
  };

  it("returns 400 for invalid entity filters", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await getAudit(
      new Request("http://localhost/api/audit?entity=invalid")
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid entity filter." });
  });

  const auditRows = [
    {
      id: "event-1",
      entity_type: "meal",
      entity_id: "meal-1",
      action: "meal.updated",
      actor_user_id: "user-1",
      created_at: "2024-02-12T10:00:00Z",
      summary: { mealId: "meal-1", name: "Pasta" }
    }
  ];

  it("returns mapped audit events", async () => {
    const { response } = await setupAuditResponse({
      url: "http://localhost/api/audit?entity=meal&limit=1",
      data: auditRows
    });

    expect(await response.json()).toEqual({
      items: [
        {
          id: "event-1",
          entityType: "meal",
          entityId: "meal-1",
          action: "meal.updated",
          actorUserId: "user-1",
          createdAt: "2024-02-12T10:00:00Z",
          summary: { mealId: "meal-1", name: "Pasta" }
        }
      ]
    });
  });

  it("filters by entity type", async () => {
    const { query } = await setupAuditResponse({
      url: "http://localhost/api/audit?entity=meal&limit=1",
      data: auditRows
    });

    expect(query.eq).toHaveBeenCalledWith("entity_type", "meal");
  });

  it("clamps limit to 100 when larger value is provided", async () => {
    const { query } = await setupAuditResponse({
      url: "http://localhost/api/audit?limit=500",
      data: []
    });

    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it("clamps limit to 1 when value is negative", async () => {
    const { query } = await setupAuditResponse({
      url: "http://localhost/api/audit?limit=-5",
      data: null
    });

    expect(query.limit).toHaveBeenCalledWith(1);
  });
});
