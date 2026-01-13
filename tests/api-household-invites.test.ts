import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireApiUser: vi.fn(),
  setAuthCookies: vi.fn()
}));

const householdMocks = vi.hoisted(() => ({
  ensureHouseholdContext: vi.fn(),
  createHouseholdInvite: vi.fn(),
  acceptHouseholdInvite: vi.fn()
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
    ensureHouseholdContext: householdMocks.ensureHouseholdContext,
    createHouseholdInvite: householdMocks.createHouseholdInvite,
    acceptHouseholdInvite: householdMocks.acceptHouseholdInvite
  };
});

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
    householdMocks.createHouseholdInvite.mockResolvedValue({
      inviteId: "invite-1",
      inviteUrl: "http://localhost:3000/invite?invite_token=token-123"
    });
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);

    const response = await createInvite(createInviteRequest({ email }));

    return { response, supabase };
  };

  const setupCreateInviteFailure = async (error: Error) => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });
    householdMocks.ensureHouseholdContext.mockResolvedValue(householdContext);
    householdMocks.createHouseholdInvite.mockRejectedValue(error);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});

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

  it("returns 400 when email format is invalid", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await createInvite(createInviteRequest({ email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid email format." });
  });

  it("returns 400 when email is missing domain", async () => {
    authMocks.requireApiUser.mockResolvedValue({ userId: "user-1", email: "test@example.com" });

    const response = await createInvite(createInviteRequest({ email: "test@" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid email format." });
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

  it("passes normalized email to the invite helper", async () => {
    const { supabase } = await setupCreateInviteSuccess();

    expect(householdMocks.createHouseholdInvite).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      { email: "ada@example.com" }
    );
  });

  it("normalizes email with whitespace and mixed case", async () => {
    const { supabase } = await setupCreateInviteSuccess("  ADA@EXAMPLE.COM  ");

    expect(householdMocks.createHouseholdInvite).toHaveBeenCalledWith(
      supabase,
      "household-1",
      "user-1",
      { email: "ada@example.com" }
    );
  });

  it("returns 500 when invite insert fails", async () => {
    const response = await setupCreateInviteFailure(new Error("db error"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to create invite." });
  });

  it("returns 500 when invite URL configuration is missing", async () => {
    const { InviteUrlConfigError } = await import("@/lib/household/server");
    const response = await setupCreateInviteFailure(
      new InviteUrlConfigError("INVITE_ACCEPT_URL_BASE not configured")
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Invite URL configuration is missing or invalid." });
  });
});

describe("POST /api/household/invites/accept", () => {
  const setupAcceptInvite = (
    result: { householdId: string; memberId: string } | { status: number; message: string },
    email: string | null = "ada@example.com"
  ) => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email
    });
    const supabase = {};
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    householdMocks.acceptHouseholdInvite.mockResolvedValue(result);

    return supabase;
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
    setupAcceptInvite({ status: 400, message: "User email is required." }, null);

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "User email is required." });
  });

  it("passes token to the invite helper", async () => {
    const supabase = setupAcceptInvite({
      householdId: "household-1",
      memberId: "member-2"
    });

    await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(householdMocks.acceptHouseholdInvite).toHaveBeenCalledWith(
      supabase,
      "user-1",
      "ada@example.com",
      { token: "token-abc" }
    );
  });

  it("accepts a valid invite", async () => {
    setupAcceptInvite({
      householdId: "household-1",
      memberId: "member-2"
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      householdId: "household-1",
      memberId: "member-2"
    });
  });

  it("rejects invites that cannot be found", async () => {
    setupAcceptInvite({ status: 400, message: "Invalid or expired invite." });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid or expired invite." });
  });

  it("rejects already used invites", async () => {
    setupAcceptInvite({ status: 409, message: "Invite already used." });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Invite already used." });
  });

  it("rejects invite for existing household members", async () => {
    setupAcceptInvite({
      status: 409,
      message: "You are already a member of this household."
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "You are already a member of this household."
    });
  });

  it("rejects invite email mismatches", async () => {
    setupAcceptInvite({
      status: 403,
      message: "This invite is for a different email address."
    });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "This invite is for a different email address." });
  });

  it("rejects expired invites", async () => {
    setupAcceptInvite({ status: 400, message: "Invite expired." });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invite expired." });
  });

  it("returns 500 when accepting invite fails", async () => {
    authMocks.requireApiUser.mockResolvedValue({
      userId: "user-1",
      email: "ada@example.com"
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue({});
    householdMocks.acceptHouseholdInvite.mockRejectedValue(new Error("rpc failed"));

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to accept invite." });
  });

  it("returns 400 when invite was deleted between validation and atomic call", async () => {
    setupAcceptInvite({ status: 400, message: "Invalid or expired invite." });

    const response = await acceptInvite(acceptInviteRequest({ token: "token-abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid or expired invite." });
  });
});
