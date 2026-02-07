import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => supabaseMocks);

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok when the database check succeeds", async () => {
    const limit = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ select });

    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns a generic error when the database check fails", async () => {
    const limit = vi.fn().mockResolvedValue({ error: { message: "db down" } });
    const select = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ select });

    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "Health check failed." });
  });
});
