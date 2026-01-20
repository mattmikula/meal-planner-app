import { beforeEach, describe, expect, it, vi } from "vitest";

let getUserMock: ReturnType<typeof vi.fn>;
let supabaseFromMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    },
    from: (...args: unknown[]) => supabaseFromMock(...args)
  })
}));

const createRequest = (options?: {
  authorization?: string;
  method?: string;
  body?: Record<string, unknown>;
}) => {
  // Determine URL path
  let path = "/api/household";
  if (options?.method === "list") {
    path = "/api/household/list";
  } else if (options?.method === "switch") {
    path = "/api/household/switch";
  }

  // Determine HTTP method
  let httpMethod = "GET";
  if (options?.method === "PATCH") {
    httpMethod = "PATCH";
  } else if (options?.method === "switch") {
    httpMethod = "POST";
  } else if (options?.method === "list") {
    httpMethod = "GET";
  }

  return new Request(`http://localhost${path}`, {
    method: httpMethod,
    headers: options?.authorization
      ? { authorization: options.authorization, ...(options.body ? { "content-type": "application/json" } : {}) }
      : options?.body ? { "content-type": "application/json" } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined
  });
};

describe("PATCH /api/household", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
    supabaseFromMock = vi.fn();
  });

  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "not auth" } });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(createRequest({ method: "PATCH", body: { name: "Test" } }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({ authorization: "Bearer token", method: "PATCH", body: {} })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Household name is required." });
  });

  it("returns 400 when name is empty", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({ authorization: "Bearer token", method: "PATCH", body: { name: "" } })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Household name cannot be empty" });
  });

  it("returns 400 when name is too long", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({
        authorization: "Bearer token",
        method: "PATCH",
        body: { name: "a".repeat(101) }
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Household name must be 100 characters or less"
    });
  });

  it("returns 400 when user is not owner", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock1 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { current_household_id: "household-456" },
        error: null
      })
    });

    const selectMock1 = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    // Mock household context fetch - user settings
    supabaseFromMock.mockReturnValueOnce({
      select: selectMock1
    });

    // Mock household membership fetch - user is a member, not owner
    // This needs to chain: .select().eq().eq().eq().maybeSingle()
    const membershipEq3Mock = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "member",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock = vi.fn().mockReturnValue({
      eq: membershipEq3Mock
    });

    const membershipEq1Mock = vi.fn().mockReturnValue({
      eq: membershipEq2Mock
    });

    const selectMock2 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock2
    });

    // Mock household fetch - fetches household details after membership check
    const householdEqMock = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "household-456",
          name: "Old Name",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const householdSelectMock = vi.fn().mockReturnValue({
      eq: householdEqMock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: householdSelectMock
    });

    // Mock second membership check - updateHouseholdName verifies role again
    const membershipEq3Mock2 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "member",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq3Mock2
    });

    const membershipEq1Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq2Mock2
    });

    const selectMock3 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock2
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock3
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({
        authorization: "Bearer token",
        method: "PATCH",
        body: { name: "New Name" }
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("owner");
  });

  it("returns 500 when update fails unexpectedly", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock1 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { current_household_id: "household-456" },
        error: null
      })
    });

    const selectMock1 = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock1
    });

    const membershipEq3Mock = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "owner",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock = vi.fn().mockReturnValue({
      eq: membershipEq3Mock
    });

    const membershipEq1Mock = vi.fn().mockReturnValue({
      eq: membershipEq2Mock
    });

    const selectMock2 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock2
    });

    const householdEqMock = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "household-456",
          name: "Old Name",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const householdSelectMock = vi.fn().mockReturnValue({
      eq: householdEqMock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: householdSelectMock
    });

    const membershipEq3Mock2 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "owner",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq3Mock2
    });

    const membershipEq1Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq2Mock2
    });

    const selectMock3 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock2
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock3
    });

    const updateEqMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" }
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock
    });

    supabaseFromMock.mockReturnValueOnce({
      update: updateMock
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({
        authorization: "Bearer token",
        method: "PATCH",
        body: { name: "New Name" }
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to update household." });
  });

  it("updates household name successfully when user is owner", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock1 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { current_household_id: "household-456" },
        error: null
      })
    });

    const selectMock1 = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    // Mock household context fetch - user settings
    supabaseFromMock.mockReturnValueOnce({
      select: selectMock1
    });

    // Mock household membership fetch - user is owner
    // This needs to chain: .select().eq().eq().eq().maybeSingle()
    const membershipEq3Mock = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "owner",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock = vi.fn().mockReturnValue({
      eq: membershipEq3Mock
    });

    const membershipEq1Mock = vi.fn().mockReturnValue({
      eq: membershipEq2Mock
    });

    const selectMock2 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock2
    });

    // Mock household fetch - fetches household details after membership check
    const householdEqMock = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "household-456",
          name: "Old Name",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const householdSelectMock = vi.fn().mockReturnValue({
      eq: householdEqMock
    });

    supabaseFromMock.mockReturnValueOnce({
      select: householdSelectMock
    });

    // Mock second membership check - updateHouseholdName verifies role again
    const membershipEq3Mock2 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "household-456",
          role: "owner",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const membershipEq2Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq3Mock2
    });

    const membershipEq1Mock2 = vi.fn().mockReturnValue({
      eq: membershipEq2Mock2
    });

    const selectMock3 = vi.fn().mockReturnValue({
      eq: membershipEq1Mock2
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock3
    });

    const updateEqMock = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    const updateMock = vi.fn().mockReturnValue({
      eq: updateEqMock
    });

    // Mock household update
    supabaseFromMock.mockReturnValueOnce({
      update: updateMock
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({
        authorization: "Bearer token",
        method: "PATCH",
        body: { name: "New Name" }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });
});

describe("GET /api/household/list", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
    supabaseFromMock = vi.fn();
  });

  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "not auth" } });

    const { GET } = await import("@/app/api/household/list/route");
    const response = await GET(createRequest({ method: "list" }));

    expect(response.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("returns empty list when user has no households", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    // Mock user settings
    supabaseFromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      })
    });

    // Mock household members query - empty
    supabaseFromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      })
    });

    const { GET } = await import("@/app/api/household/list/route");
    const response = await GET(createRequest({ authorization: "Bearer token", method: "list" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ households: [] });
  });

  it("returns list of households with current marked", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    // Mock user settings - current household is household-456
    supabaseFromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { current_household_id: "household-456" },
            error: null
          })
        })
      })
    });

    // Mock household members query
    supabaseFromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  household_id: "household-456",
                  role: "owner",
                  households: { id: "household-456", name: "Smith Family" }
                },
                {
                  household_id: "household-789",
                  role: "member",
                  households: { id: "household-789", name: "Work Team" }
                }
              ],
              error: null
            })
          })
        })
      })
    });

    const { GET } = await import("@/app/api/household/list/route");
    const response = await GET(createRequest({ authorization: "Bearer token", method: "list" }));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.households).toHaveLength(2);
    expect(json.households[0]).toEqual({
      householdId: "household-456",
      householdName: "Smith Family",
      role: "owner",
      isCurrent: true
    });
    expect(json.households[1]).toEqual({
      householdId: "household-789",
      householdName: "Work Team",
      role: "member",
      isCurrent: false
    });
  });
});

describe("POST /api/household/switch", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
    supabaseFromMock = vi.fn();
  });

  it("returns 401 when not authenticated", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "not auth" } });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({ method: "switch", body: { householdId: "household-456" } })
    );

    expect(response.status).toBe(401);
    expect(supabaseFromMock).not.toHaveBeenCalled();
  });

  it("returns 400 when householdId is missing", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({ authorization: "Bearer token", method: "switch", body: {} })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Household ID is required." });
  });

  it("returns 400 when householdId is not a valid UUID", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({
        authorization: "Bearer token",
        method: "switch",
        body: { householdId: "not-a-uuid" }
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid household ID" });
  });

  it("returns 400 when user is not a member of the household", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock3 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    });

    const eqMock2 = vi.fn().mockReturnValue({
      eq: eqMock3
    });

    const eqMock1 = vi.fn().mockReturnValue({
      eq: eqMock2
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    // Mock membership check - not found
    supabaseFromMock.mockReturnValueOnce({
      select: selectMock
    });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({
        authorization: "Bearer token",
        method: "switch",
        body: { householdId: "a0000000-0000-4000-8000-000000000456" }
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain("not a member");
  });

  it("switches household successfully", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock3 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "a0000000-0000-4000-8000-000000000456",
          role: "member",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const eqMock2 = vi.fn().mockReturnValue({
      eq: eqMock3
    });

    const eqMock1 = vi.fn().mockReturnValue({
      eq: eqMock2
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    // Mock membership check - user is member
    supabaseFromMock.mockReturnValueOnce({
      select: selectMock
    });

    const upsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: null
    });

    // Mock upsert
    supabaseFromMock.mockReturnValueOnce({
      upsert: upsertMock
    });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({
        authorization: "Bearer token",
        method: "switch",
        body: { householdId: "a0000000-0000-4000-8000-000000000456" }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
  });

  it("returns 500 when switch fails unexpectedly", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const eqMock3 = vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "member-123",
          household_id: "a0000000-0000-4000-8000-000000000456",
          role: "member",
          status: "active",
          created_at: "2024-01-01"
        },
        error: null
      })
    });

    const eqMock2 = vi.fn().mockReturnValue({
      eq: eqMock3
    });

    const eqMock1 = vi.fn().mockReturnValue({
      eq: eqMock2
    });

    const selectMock = vi.fn().mockReturnValue({
      eq: eqMock1
    });

    supabaseFromMock.mockReturnValueOnce({
      select: selectMock
    });

    const upsertMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "db error" }
    });

    supabaseFromMock.mockReturnValueOnce({
      upsert: upsertMock
    });

    const { POST } = await import("@/app/api/household/switch/route");
    const response = await POST(
      createRequest({
        authorization: "Bearer token",
        method: "switch",
        body: { householdId: "a0000000-0000-4000-8000-000000000456" }
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Failed to switch household" });
  });
});
