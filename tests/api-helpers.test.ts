import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyAuthCookies, isSecureRequest, jsonError } from "@/lib/api/helpers";

// Mock setAuthCookies from auth/server
const mockSetAuthCookies = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  setAuthCookies: (...args: unknown[]) => mockSetAuthCookies(...args)
}));

describe("jsonError", () => {
  it("creates a JSON response with error message and status", async () => {
    const response = jsonError("Something went wrong", 400);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Something went wrong" });
  });

  it("supports different status codes", async () => {
    const response = jsonError("Not found", 404);

    expect(response.status).toBe(404);
  });
});

describe("isSecureRequest", () => {
  it("returns true for https URL without forwarded proto", () => {
    expect(isSecureRequest("https://example.com/api")).toBe(true);
  });

  it("returns false for http URL without forwarded proto", () => {
    expect(isSecureRequest("http://example.com/api")).toBe(false);
  });

  it("returns true when X-Forwarded-Proto is https", () => {
    expect(isSecureRequest("http://localhost/api", "https")).toBe(true);
  });

  it("returns false when X-Forwarded-Proto is http", () => {
    expect(isSecureRequest("https://localhost/api", "http")).toBe(false);
  });

  it("handles comma-separated X-Forwarded-Proto values", () => {
    expect(isSecureRequest("http://localhost/api", "https, http")).toBe(true);
    expect(isSecureRequest("http://localhost/api", "http, https")).toBe(false);
  });

  it("trims whitespace from X-Forwarded-Proto", () => {
    expect(isSecureRequest("http://localhost/api", "  https  ")).toBe(true);
  });

  it("is case-insensitive for X-Forwarded-Proto", () => {
    expect(isSecureRequest("http://localhost/api", "HTTPS")).toBe(true);
    expect(isSecureRequest("http://localhost/api", "HTTP")).toBe(false);
  });

  it("returns false for unexpected X-Forwarded-Proto values", () => {
    expect(isSecureRequest("https://localhost/api", "ftp")).toBe(false);
    expect(isSecureRequest("https://localhost/api", "")).toBe(true); // empty string is falsy, falls through to URL check
  });

  it("returns false for null forwarded proto with http URL", () => {
    expect(isSecureRequest("http://localhost/api", null)).toBe(false);
  });
});

describe("applyAuthCookies", () => {
  // Minimal mock session that satisfies the type
  const mockSession = {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "user-1", email: "test@example.com" }
  } as Parameters<typeof applyAuthCookies>[1];

  beforeEach(() => {
    mockSetAuthCookies.mockClear();
  });

  it("does not call setAuthCookies when session is undefined", () => {
    const response = jsonError("test", 200);
    const request = new Request("https://example.com/api");

    applyAuthCookies(response, undefined, request);

    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });

  it("calls setAuthCookies with secure=true for HTTPS requests", () => {
    const response = jsonError("test", 200);
    const request = new Request("https://example.com/api");

    applyAuthCookies(response, mockSession, request);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(response, mockSession, { secure: true });
  });

  it("calls setAuthCookies with secure=false for HTTP requests", () => {
    const response = jsonError("test", 200);
    const request = new Request("http://localhost/api");

    applyAuthCookies(response, mockSession, request);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(response, mockSession, { secure: false });
  });

  it("uses X-Forwarded-Proto header to determine secure flag", () => {
    const response = jsonError("test", 200);
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-proto": "https" }
    });

    applyAuthCookies(response, mockSession, request);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(response, mockSession, { secure: true });
  });
});
