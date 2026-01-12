import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "@/lib/api/client";

type FetchCapture = {
  request?: Request;
  bodyText?: string;
};

const createFetchMock = (capture?: FetchCapture) =>
  vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input.clone() : new Request(input, init);
    if (capture) {
      capture.request = request;
      capture.bodyText = await request.text();
    }
    return new Response(JSON.stringify({ id: "user-123", email: "test@example.com" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  });

describe("createApiClient", () => {
  it("adds auth and custom headers when provided", async () => {
    const capture: FetchCapture = {};
    const fetchMock = createFetchMock(capture);
    const client = createApiClient({
      baseUrl: "http://localhost",
      token: "token-123",
      headers: { "x-client": "meal-planner" },
      fetch: fetchMock
    });

    await client.GET("/api/me");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(capture.request?.url).toBe("http://localhost/api/me");
    expect(capture.request?.headers.get("Authorization")).toBe("Bearer token-123");
    expect(capture.request?.headers.get("x-client")).toBe("meal-planner");
  });

  it("omits auth header when token is not provided", async () => {
    const capture: FetchCapture = {};
    const fetchMock = createFetchMock(capture);
    const client = createApiClient({
      baseUrl: "http://localhost",
      fetch: fetchMock
    });

    await client.GET("/api/me");

    expect(capture.request?.headers.get("Authorization")).toBeNull();
  });

  it("serializes verify-otp payload as JSON", async () => {
    const capture: FetchCapture = {};
    const fetchMock = createFetchMock(capture);
    const client = createApiClient({
      baseUrl: "http://localhost",
      fetch: fetchMock
    });

    await client.POST("/api/verify-otp", {
      body: {
        email: "ada@example.com",
        token: "123456"
      }
    });

    expect(capture.request?.url).toBe("http://localhost/api/verify-otp");
    expect(capture.request?.method).toBe("POST");
    expect(JSON.parse(capture.bodyText ?? "{}")).toEqual({
      email: "ada@example.com",
      token: "123456"
    });
    expect(capture.request?.headers.get("content-type")).toContain("application/json");
  });

  it("sends logout as a POST without a body", async () => {
    const capture: FetchCapture = {};
    const fetchMock = createFetchMock(capture);
    const client = createApiClient({
      baseUrl: "http://localhost",
      fetch: fetchMock
    });

    await client.POST("/api/logout");

    expect(capture.request?.url).toBe("http://localhost/api/logout");
    expect(capture.request?.method).toBe("POST");
    expect(capture.bodyText).toBe("");
    expect(capture.request?.headers.get("content-type")).toBeNull();
  });
});
