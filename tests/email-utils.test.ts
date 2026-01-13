import { describe, expect, it } from "vitest";

import { normalizeEmail } from "@/lib/utils/email";

describe("normalizeEmail", () => {
  it("returns null for null input", () => {
    expect(normalizeEmail(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(normalizeEmail(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeEmail("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("\t\n")).toBeNull();
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalizeEmail("  user@example.com  ")).toBe("user@example.com");
    expect(normalizeEmail("\tuser@example.com\n")).toBe("user@example.com");
  });

  it("converts to lowercase", () => {
    expect(normalizeEmail("User@Example.COM")).toBe("user@example.com");
    expect(normalizeEmail("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("handles mixed case and whitespace", () => {
    expect(normalizeEmail("  User@Example.com  ")).toBe("user@example.com");
  });

  it("preserves already normalized emails", () => {
    expect(normalizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("handles emails with special characters", () => {
    expect(normalizeEmail("user+tag@example.com")).toBe("user+tag@example.com");
    expect(normalizeEmail("user.name@example.co.uk")).toBe("user.name@example.co.uk");
  });

  it("handles emails with numbers", () => {
    expect(normalizeEmail("user123@example.com")).toBe("user123@example.com");
  });
});
