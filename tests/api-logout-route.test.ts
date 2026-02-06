import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  clearAuthCookies: vi.fn(),
  setAuthCookies: vi.fn()
}));

vi.mock("@/lib/auth/server", () => authMocks);

import { POST } from "@/app/api/logout/route";

describe("POST /api/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears auth cookies on secure HTTPS requests", async () => {
    const response = await POST(
      new Request("https://example.com/api/logout", {
        method: "POST"
      })
    );

    expect(response.status).toBe(200);
    expect(authMocks.clearAuthCookies).toHaveBeenCalledWith(
      expect.anything(),
      { secure: true }
    );
  });

  it("uses x-forwarded-proto when determining secure cookies", async () => {
    await POST(
      new Request("http://localhost/api/logout", {
        method: "POST",
        headers: { "x-forwarded-proto": "https" }
      })
    );

    expect(authMocks.clearAuthCookies).toHaveBeenCalledWith(
      expect.anything(),
      { secure: true }
    );
  });
});
