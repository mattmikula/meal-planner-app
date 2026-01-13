import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQuery } from "@/tests/supabase-mock";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => {
  class InviteUrlConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "InviteUrlConfigError";
    }
  }

  return {
    ensureHouseholdContext: vi.fn(),
    createInviteToken: vi.fn(),
    buildInviteExpiry: vi.fn(),
    buildInviteUrl: vi.fn(),
    fetchHouseholdMembership: vi.fn(),
    hashInviteToken: vi.fn(),
    InviteUrlConfigError
  };
});

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/auth/server", () => authMocks);

vi.mock("@/lib/household/server", () => householdMocks);

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { POST as createInvite } from "@/app/api/household/invites/route";
import { POST as acceptInvite } from "@/app/api/household/invites/accept/route";

const householdContext = {
  household: {
    id: "household-1",
    name: null,
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

const createInviteRequest = (body: unknown) =>
  new Request("http://localhost/api/household/invites", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body)
  });

const acceptInviteRequest = (body: unknown) =>
  new Request("http://localhost/api/household/invites/accept", {
    method: "POST",
    body: JSON.stringify(body)
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/household/invites", () => {
  const setupCreateInviteSuccess = async (email = "Ada@Example.com") => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    householdMocks.createInviteToken.mockReturnValue({ token: "token-123", tokenHash: "hash-123" });
    householdMocks.buildInviteExpiry.mockReturnValue("2024-02-14T10:00:00Z");
    householdMocks.buildInviteUrl.mockReturnValue(
      "http://localhost:3000/invite?invite_token=token-123"
    );

    const insertQuery = createQuery({
      data: { id: "invite-1" },
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(insertQuery)
    });

    const response = await createInvite(createInviteRequest({ email }));

    return { response, insertQuery };
  };

  const setupCreateInviteInsertFailure = async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    householdMocks.createInviteToken.mockReturnValue({ token: "token-123", tokenHash: "hash-123" });
    householdMocks.buildInviteExpiry.mockReturnValue("2024-02-14T10:00:00Z");
    householdMocks.buildInviteUrl.mockReturnValue(
      "http://localhost:3000/invite?invite_token=token-123"
    );

    const insertQuery = createQuery({
      data: null,
      error: { message: "db error" }
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(insertQuery)
    });

    return createInvite(createInviteRequest({ email: "ada@example.com" }));
  };

  it("returns 400 for invalid JSON payload", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await createInvite(createInviteRequest("{invalid"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid request body." });
  });

  it("returns 400 when email is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await createInvite(createInviteRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Email is required." });
  });

  it("returns 400 when email is not a string", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await createInvite(createInviteRequest({ email: 123 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Email must be a string." });
  });

  it("does not touch the database when email is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    await createInvite(createInviteRequest({}));

    expect(supabaseMocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns invite id on success", async () => {
    const { response } = await setupCreateInviteSuccess();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      inviteId: "invite-1",
      inviteUrl: "http://localhost:3000/invite?invite_token=token-123"
    });
  });

  it("writes invite record with normalized email (lowercase)", async () => {
    const { insertQuery } = await setupCreateInviteSuccess();

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: "household-1",
        email: "ada@example.com",
        token_hash: "hash-123",
        expires_at: "2024-02-14T10:00:00Z",
        created_by: "user-1"
      })
    );
  });

  it("includes the invite link on success", async () => {
    await setupCreateInviteSuccess();

    expect(householdMocks.buildInviteUrl).toHaveBeenCalledWith("token-123");
  });

  it("normalizes mixed-case email to lowercase", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const insertQuery = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({
        data: [{ id: "invite-1", token_hash: "hash-123" }],
        error: null
      })
    };

    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(insertQuery)
    });

    // Input email with mixed case
    await createInvite(createInviteRequest({ email: "Ada@Example.com" }));

    // Verify it was normalized to lowercase in the database insert
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com"
      })
    );
  });

  it("normalizes email with whitespace and mixed case", async () => {
    const { insertQuery } = await setupCreateInviteSuccess("  ADA@EXAMPLE.COM  ");

    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "ada@example.com"
      })
    );
  });

  it("returns 500 when invite insert fails", async () => {
    const response = await setupCreateInviteInsertFailure();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db error" });
  });

  it("returns 500 when invite URL configuration is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    householdMocks.createInviteToken.mockReturnValue({ token: "token-123", tokenHash: "hash-123" });
    householdMocks.buildInviteUrl.mockImplementation(() => {
      throw new householdMocks.InviteUrlConfigError("INVITE_ACCEPT_URL_BASE not configured");
    });

    const response = await createInvite(createInviteRequest({ email: "ada@example.com" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Invite URL configuration is missing or invalid." });
  });
});

describe("POST /api/household/invites/accept", () => {
  const setupAcceptInviteBase = () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });
    householdMocks.hashInviteToken.mockReturnValue("hash-abc");
    const rpcMock = vi.fn();
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ rpc: rpcMock });
    return rpcMock;
  };

  it("returns 400 when token is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });

    const response = await acceptInvite(acceptInviteRequest({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Token is required." });
  });

  it("returns 400 when token is only whitespace", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "   " }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Token cannot be empty or whitespace." });
  });

  it("returns 400 when token is not a string", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });

    const response = await acceptInvite(acceptInviteRequest({ token: 123 }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Token is required." });
  });

  it("does not touch the database when token is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });

    await acceptInvite(acceptInviteRequest({}));

    expect(supabaseMocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("returns 400 when user email is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: null
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "User email is required." });
  });

  it("does not touch the database when user email is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: null
    });

    await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(supabaseMocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("accepts a valid invite", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: "household-1",
        member_id: "member-2",
        error_message: null,
        error_status: null
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      householdId: "household-1",
      memberId: "member-2"
    });
  });

  it("looks up invites by token hash", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: "household-1",
        member_id: "member-2",
        error_message: null,
        error_status: null
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(rpcMock).toHaveBeenCalledWith("accept_household_invite", {
      p_token_hash: "hash-abc"
    });
  });

  it("rejects invites that cannot be found", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: null,
        member_id: null,
        error_message: "Invalid or expired invite.",
        error_status: 400
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid or expired invite." });
  });

  it("rejects already used invites", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: null,
        member_id: null,
        error_message: "Invite already used.",
        error_status: 409
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Invite already used." });
  });

  it("rejects invite for existing household members", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: null,
        member_id: null,
        error_message: "User already belongs to this household.",
        error_status: 409
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "User already belongs to this household."
    });
  });

  it("rejects invite email mismatches", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: null,
        member_id: null,
        error_message: "This invite was sent to a different email address than the one you're signed in with.",
        error_status: 403
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This invite was sent to a different email address than the one you're signed in with." });
  });

  it("rejects expired invites", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: {
        household_id: null,
        member_id: null,
        error_message: "Invite expired.",
        error_status: 400
      },
      error: null
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invite expired." });
  });

  it("returns 500 when accepting invite fails", async () => {
    const rpcMock = setupAcceptInviteBase();
    const rpcQuery = createQuery({
      data: null,
      error: { message: "rpc failed" }
    });
    rpcMock.mockReturnValue(rpcQuery);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "rpc failed" });
  });
});
