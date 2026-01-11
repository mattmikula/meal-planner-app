import { describe, expect, it } from "vitest";

import { getBearerToken } from "@/lib/api/auth";

const createRequest = (authorization?: string) =>
  new Request("http://localhost/api/me", {
    headers: authorization ? { authorization } : undefined
  });

describe("getBearerToken", () => {
  it("returns null when Authorization header is missing", () => {
    expect(getBearerToken(createRequest())).toBeNull();
  });

  it("returns null when Bearer token is empty", () => {
    expect(getBearerToken(createRequest("Bearer "))).toBeNull();
  });

  it("accepts case-insensitive bearer scheme", () => {
    expect(getBearerToken(createRequest("bearer token-123"))).toBe("token-123");
  });
});
