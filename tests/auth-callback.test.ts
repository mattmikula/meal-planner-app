import { describe, expect, it, vi } from "vitest";

import { completeAuthCallback } from "@/lib/auth/callback";

const createSupabaseMock = () => ({
  auth: {
    exchangeCodeForSession: vi.fn(),
    getSession: vi.fn()
  }
});

describe("completeAuthCallback", () => {
  it("passes the auth code to exchangeCodeForSession", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const setStatus = vi.fn();
    const replace = vi.fn();
    const currentUrl = "http://localhost/auth/callback?code=abc123";

    await completeAuthCallback({ supabase, currentUrl, setStatus, replace });

    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
  });

  it("reports an error when exchangeCodeForSession fails", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid_grant" }
    });
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const setStatus = vi.fn();
    const replace = vi.fn();

    await completeAuthCallback({
      supabase,
      currentUrl: "http://localhost/auth/callback?code=bad",
      setStatus,
      replace
    });

    expect(setStatus).toHaveBeenCalledWith(
      "Sign-in failed. Try again from the homepage."
    );
    expect(supabase.auth.getSession).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("continues when exchange fails but session exists", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({
      error: { message: "invalid_grant" }
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } }
    });

    const setStatus = vi.fn();
    const replace = vi.fn();

    await completeAuthCallback({
      supabase,
      currentUrl: "http://localhost/auth/callback?code=already-used",
      setStatus,
      replace
    });

    expect(setStatus).toHaveBeenCalledWith("Signed in. Redirecting...");
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("warns when no session exists after callback", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    const setStatus = vi.fn();
    const replace = vi.fn();

    await completeAuthCallback({
      supabase,
      currentUrl: "http://localhost/auth/callback",
      setStatus,
      replace
    });

    expect(setStatus).toHaveBeenCalledWith(
      "No session found. Try signing in again."
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects after a successful sign-in", async () => {
    const supabase = createSupabaseMock();
    supabase.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "token" } }
    });

    const setStatus = vi.fn();
    const replace = vi.fn();

    await completeAuthCallback({
      supabase,
      currentUrl: "http://localhost/auth/callback?code=ok",
      setStatus,
      replace
    });

    expect(setStatus).toHaveBeenCalledWith("Signed in. Redirecting...");
    expect(replace).toHaveBeenCalledWith("/");
  });
});
