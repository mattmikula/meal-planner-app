import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQuery } from "@/tests/supabase-mock";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => ({
  ensureHouseholdContext: vi.fn(),
  createInviteToken: vi.fn(),
  buildInviteExpiry: vi.fn(),
  buildInviteUrl: vi.fn(),
  fetchHouseholdMembership: vi.fn(),
  hashInviteToken: vi.fn()
}));

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

const baseInvite = {
  id: "invite-1",
  household_id: "household-1",
  email: "ada@example.com",
  expires_at: "2099-01-01T00:00:00Z",
  accepted_at: null
};

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

  it("writes invite record with normalized email", async () => {
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

  it("returns 500 when invite insert fails", async () => {
    const response = await setupCreateInviteInsertFailure();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db error" });
  });

  it("returns 500 when invite URL configuration is missing", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    householdMocks.createInviteToken.mockReturnValue({ token: "token-123", tokenHash: "hash-123" });
    householdMocks.buildInviteUrl.mockReturnValue(null);

    const response = await createInvite(createInviteRequest({ email: "ada@example.com" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Missing invite URL configuration." });
  });
});

describe("POST /api/household/invites/accept", () => {
  const setupAcceptInviteBase = () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });
    householdMocks.fetchHouseholdMembership.mockResolvedValue(null);
    householdMocks.hashInviteToken.mockReturnValue("hash-abc");
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
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    const updateQuery = createQuery({
      data: { id: "invite-1" },
      error: null
    });
    const insertQuery = createQuery({
      data: { id: "member-2" },
      error: null
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(insertQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from: fromMock });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      householdId: "household-1",
      memberId: "member-2"
    });
  });

  it("looks up invites by token hash", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    const updateQuery = createQuery({
      data: { id: "invite-1" },
      error: null
    });
    const insertQuery = createQuery({
      data: { id: "member-2" },
      error: null
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(insertQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from: fromMock });

    await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(selectQuery.eq).toHaveBeenCalledWith("token_hash", "hash-abc");
  });

  it("rejects invites that cannot be found", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: null,
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectQuery)
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid or expired invite." });
  });

  it("rejects already used invites", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: {
        ...baseInvite,
        accepted_at: "2024-02-12T10:00:00Z"
      },
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectQuery)
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Invite already used." });
  });

  it("rejects invite for existing members", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });
    householdMocks.fetchHouseholdMembership.mockResolvedValue({
      id: "member-1",
      householdId: "household-1",
      userId: "user-1",
      role: "owner",
      status: "active",
      createdAt: "2024-02-12T10:00:00Z"
    });
    householdMocks.hashInviteToken.mockReturnValue("hash-abc");

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectQuery)
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "User already belongs to a household."
    });
  });

  it("rejects invite email mismatches", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: {
        ...baseInvite,
        email: "other@example.com"
      },
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectQuery)
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Invite email does not match." });
  });

  it("rejects expired invites", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: {
        ...baseInvite,
        expires_at: "2000-01-01T00:00:00Z"
      },
      error: null
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({
      from: vi.fn().mockReturnValue(selectQuery)
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invite expired." });
  });

  it("returns 500 when accepting invite fails", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    const updateQuery = createQuery({
      data: null,
      error: { message: "update failed" }
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from: fromMock });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "update failed" });
  });

  it("returns 409 when invite is already used during update", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    const updateQuery = createQuery({
      data: null,
      error: null
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from: fromMock });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Invite already used." });
  });

  it("returns 500 when membership creation fails", async () => {
    setupAcceptInviteBase();

    const selectQuery = createQuery({
      data: baseInvite,
      error: null
    });
    const updateQuery = createQuery({
      data: { id: "invite-1" },
      error: null
    });
    const insertQuery = createQuery({
      data: null,
      error: { message: "member insert failed" }
    });
    const fromMock = vi
      .fn()
      .mockReturnValueOnce(selectQuery)
      .mockReturnValueOnce(updateQuery)
      .mockReturnValueOnce(insertQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from: fromMock });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "member insert failed" });
  });
});
