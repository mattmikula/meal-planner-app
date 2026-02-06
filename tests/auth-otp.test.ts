import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";

const verifyOtpMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      verifyOtp: (...args: unknown[]) => verifyOtpMock(...args)
    }
  })
}));

const createRequest = (body?: Record<string, unknown>) =>
  new Request("http://localhost/api/verify-otp", {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

describe("POST /api/verify-otp", () => {
  beforeEach(() => {
    verifyOtpMock.mockReset();
  });

  it("returns 400 when body is missing", async () => {
    const { POST } = await import("@/app/api/verify-otp/route");
    const response = await POST(createRequest());

    expect(response.status).toBe(400);
  });

  it("returns 400 when email or code is missing", async () => {
    const { POST } = await import("@/app/api/verify-otp/route");
    const response = await POST(createRequest({ email: "test@example.com" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when email format is invalid", async () => {
    const { POST } = await import("@/app/api/verify-otp/route");
    const response = await POST(
      createRequest({ email: "not-an-email", token: "123456" })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid email format." });
  });

  it("returns 401 when verification fails", async () => {
    verifyOtpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "invalid" }
    });

    const { POST } = await import("@/app/api/verify-otp/route");
    const response = await POST(
      createRequest({ email: "test@example.com", token: "123456" })
    );

    expect(response.status).toBe(401);
  });

  it("returns user payload when verification succeeds", async () => {
    verifyOtpMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token",
          refresh_token: "refresh",
          expires_in: 3600
        },
        user: { id: "user-123", email: "test@example.com" }
      },
      error: null
    });

    const { POST } = await import("@/app/api/verify-otp/route");
    const response = await POST(
      createRequest({ email: "test@example.com", token: "123456" })
    );

    expect(verifyOtpMock).toHaveBeenCalledWith({
      email: "test@example.com",
      token: "123456",
      type: "email"
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: "user-123",
      email: "test@example.com"
    });
  });
});
