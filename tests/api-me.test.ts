import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("GET /api/me", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
    refreshSessionMock = vi.fn();
  });

  it("returns 401 when credentials are missing", async () => {
    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when Bearer token is empty", async () => {
    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest({ authorization: "Bearer " }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns user payload when token is valid", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest({ authorization: "Bearer good-token" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
  });

  it("returns user payload when cookie token is valid", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(
      createRequest({
        cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token`
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
  });

  it("refreshes when the access token is missing but refresh token exists", async () => {
    refreshSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "new-token", refresh_token: "new-refresh", expires_in: 3600 },
        user: { id: "user-123", email: "test@example.com" }
      },
      error: null
    });

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(
      createRequest({
        cookie: `${REFRESH_TOKEN_COOKIE}=refresh-token`
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
    expect(refreshSessionMock).toHaveBeenCalledWith({ refresh_token: "refresh-token" });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("refreshes when the access token is rejected and refresh token exists", async () => {
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

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(
      createRequest({
        cookie: `${ACCESS_TOKEN_COOKIE}=expired; ${REFRESH_TOKEN_COOKIE}=refresh-token`
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
    expect(refreshSessionMock).toHaveBeenCalledWith({ refresh_token: "refresh-token" });
  });
});
