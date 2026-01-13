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

import { GET as getHousehold } from "@/app/api/household/route";
import { GET as getMembers } from "@/app/api/household/members/route";

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/household", () => {
  const setupHouseholdSuccess = async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com",
      session: authSession
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});

    return getHousehold(
      new Request("https://localhost/api/household")
    );
  };

  it("returns unauthorized response when auth fails", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401 }
    );
    authMocks.requireApiUser.mockResolvedValue({ response: unauthorizedResponse });

    const response = await getHousehold(
      new Request("https://localhost/api/household")
    );

    expect(response).toBe(unauthorizedResponse);
  });

  it("returns household context when session exists", async () => {
    const response = await setupHouseholdSuccess();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "household-1",
      name: "Home",
      role: "owner",
      status: "active"
    });
  });

  it("sets auth cookies when session exists", async () => {
    await setupHouseholdSuccess();

    expect(authMocks.setAuthCookies).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/household/members", () => {
  const setupMembersResponse = async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const query = createQuery({
      data: [
        {
          id: "member-1",
          user_id: "user-1",
          role: "owner",
          status: "active",
          created_at: "2024-02-12T10:00:00Z"
        }
      ],
      error: null
    });
    const supabase = {
      from: vi.fn().mockReturnValue(query)
    };
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);

    const response = await getMembers(
      new Request("http://localhost/api/household/members")
    );

    return { response, supabase };
  };

  it("returns mapped household members", async () => {
    const { response } = await setupMembersResponse();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      members: [
        {
          id: "member-1",
          userId: "user-1",
          role: "owner",
          status: "active",
          createdAt: "2024-02-12T10:00:00Z"
        }
      ]
    });
  });

  it("queries household members table", async () => {
    const { supabase } = await setupMembersResponse();

    expect(supabase.from).toHaveBeenCalledWith("household_members");
  });

  it("returns 500 when Supabase query fails", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "test@example.com"
    });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);

    const query = createQuery({
      data: null,
      error: { message: "db error" }
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(query)
    });

    const response = await getMembers(
      new Request("http://localhost/api/household/members")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db error" });
  });
});
