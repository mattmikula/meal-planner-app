import { beforeEach, describe, expect, it, vi } from "vitest";

import { getBearerToken, requireApiUser } from "@/lib/auth/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/shared";

let getUserMock: ReturnType<typeof vi.fn>;
let refreshSessionMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      refreshSession: (...args: unknown[]) => refreshSessionMock(...args)
    }
  })
}));

const createRequest = (options?: { authorization?: string; cookie?: string }) =>
  new Request("http://localhost/api/me", {
    headers: options
      ? {
          ...(options.authorization ? { authorization: options.authorization } : {}),
          ...(options.cookie ? { cookie: options.cookie } : {})
        }
      : undefined
  });

describe("getBearerToken", () => {
  it("returns null when Authorization header is missing", () => {
    expect(getBearerToken(createRequest())).toBeNull();
  });

  it("returns null when Bearer token is empty", () => {
    expect(getBearerToken(createRequest({ authorization: "Bearer " }))).toBeNull();
  });

  it("accepts case-insensitive bearer scheme", () => {
    expect(getBearerToken(createRequest({ authorization: "bearer token-123" }))).toBe("token-123");
  });
});

describe("requireApiUser", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
    refreshSessionMock = vi.fn();
  });

  it("returns 401 when credentials are missing", async () => {
    const result = await requireApiUser(createRequest());

    if (!("response" in result)) {
      throw new Error("Expected response error");
    }

    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns user when access token is valid", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const result = await requireApiUser(
      createRequest({ authorization: "Bearer good-token" })
    );

    if ("response" in result) {
      throw new Error("Expected user response");
    }

    expect(result).toEqual({ userId: "user-123", email: "test@example.com" });
  });

  it("returns user when access cookie is valid", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const result = await requireApiUser(
      createRequest({ cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token` })
    );

    if ("response" in result) {
      throw new Error("Expected user response");
    }

    expect(result).toEqual({ userId: "user-123", email: "test@example.com" });
  });

  it("refreshes when only a refresh token exists", async () => {
    refreshSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "new-token", refresh_token: "new-refresh", expires_in: 3600 },
        user: { id: "user-123", email: "test@example.com" }
      },
      error: null
    });

    const result = await requireApiUser(
      createRequest({ cookie: `${REFRESH_TOKEN_COOKIE}=refresh-token` })
    );

    if ("response" in result) {
      throw new Error("Expected user response");
    }

    expect(result.userId).toBe("user-123");
    expect(result.email).toBe("test@example.com");
    expect(result.session?.access_token).toBe("new-token");
  });

  it("refreshes when access token is rejected and refresh token exists", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" }
    });
    refreshSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "new-token", refresh_token: "new-refresh", expires_in: 3600 },
        user: { id: "user-123", email: "test@example.com" }
      },
      error: null
    });

    const result = await requireApiUser(
      createRequest({
        cookie: `${ACCESS_TOKEN_COOKIE}=expired; ${REFRESH_TOKEN_COOKIE}=refresh-token`
      })
    );

    if ("response" in result) {
      throw new Error("Expected user response");
    }

    expect(result.userId).toBe("user-123");
    expect(result.session?.access_token).toBe("new-token");
  });

  it("returns 401 when refresh fails", async () => {
    refreshSessionMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "invalid refresh" }
    });

    const result = await requireApiUser(
      createRequest({ cookie: `${REFRESH_TOKEN_COOKIE}=refresh-token` })
    );

    if (!("response" in result)) {
      throw new Error("Expected response error");
    }

    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({ error: "Unauthorized" });
  });
});
