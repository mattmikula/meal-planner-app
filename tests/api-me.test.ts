import { beforeEach, describe, expect, it, vi } from "vitest";

let getUserMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args)
    }
  })
}));

const createRequest = (authorization?: string) =>
  new Request("http://localhost/api/me", {
    headers: authorization ? { authorization } : undefined
  });

describe("GET /api/me", () => {
  beforeEach(() => {
    getUserMock = vi.fn();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when Bearer token is empty", async () => {
    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest("Bearer "));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when Supabase rejects the token", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" }
    });

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest("Bearer bad-token"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns user payload when token is valid", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-123", email: "test@example.com" } },
      error: null
    });

    const { GET } = await import("@/app/api/me/route");
    const response = await GET(createRequest("Bearer good-token"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
  });
});
