import { beforeEach, describe, expect, it, vi } from "vitest";

describe("GET /api/openapi", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock("node:fs/promises");
  });

  it("returns the OpenAPI YAML document", async () => {
    const { GET } = await import("@/app/api/openapi/route");
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/yaml");
  });

  it("returns a generic error when the spec cannot be read", async () => {
    vi.doMock("node:fs/promises", () => ({
      readFile: vi.fn().mockRejectedValue(new Error("ENOENT"))
    }));

    const { GET } = await import("@/app/api/openapi/route");
    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load OpenAPI spec." });
  });
});
