import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => ({
  listHouseholdsForUser: vi.fn()
}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/auth/server", () => authMocks);

vi.mock("@/lib/household/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/household/server")>(
    "@/lib/household/server"
  );
  return {
    ...actual,
    listHouseholdsForUser: householdMocks.listHouseholdsForUser
  };
});

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { GET } from "@/app/api/households/route";

describe("GET /api/households", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthorized response when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await GET(
      new Request("https://localhost/api/households")
    );

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns the user household list", async () => {
    const supabase = {};
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    householdMocks.listHouseholdsForUser.mockResolvedValue([
      {
        id: "household-1",
        name: "Home",
        role: "owner",
        status: "active",
        isCurrent: true
      }
    ]);

    const response = await GET(
      new Request("https://localhost/api/households")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      households: [
        {
          id: "household-1",
          name: "Home",
          role: "owner",
          status: "active",
          isCurrent: true
        }
      ]
    });
  });
});
