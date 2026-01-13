import { describe, expect, it } from "vitest";

import { isSecureRequest, jsonError } from "@/lib/api/helpers";

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
