import { beforeEach, describe, expect, it, vi } from "vitest";

let requireApiUserMock: ReturnType<typeof vi.fn>;
let setCurrentHouseholdForUserMock: ReturnType<typeof vi.fn>;

vi.mock("@/lib/auth/server", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args)
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({})
}));

vi.mock("@/lib/household/server", async () => {
  const actual = await vi.importActual<typeof import("@/lib/household/server")>(
    "@/lib/household/server"
  );
  return {
    ...actual,
    setCurrentHouseholdForUser: (...args: unknown[]) =>
      setCurrentHouseholdForUserMock(...args)
  };
});

const createRequest = (body: unknown) =>
  new Request("http://localhost/api/household", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

describe("PATCH /api/household", () => {
  beforeEach(() => {
    requireApiUserMock = vi.fn();
    setCurrentHouseholdForUserMock = vi.fn();
  });

  it("returns the updated household context", async () => {
    requireApiUserMock.mockResolvedValue({
      userId: "user-123",
      email: null
    });

    setCurrentHouseholdForUserMock.mockResolvedValue({
      household: {
        id: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
        name: "Home",
        createdAt: "2024-02-12T10:00:00Z"
      },
      membership: {
        id: "6f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
        householdId: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
        userId: "user-123",
        role: "owner",
        status: "active",
        createdAt: "2024-02-12T10:00:00Z"
      }
    });

    const { PATCH } = await import("@/app/api/household/route");
    const response = await PATCH(
      createRequest({
        householdId: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
        name: "Home"
      })
    );

    expect(response.status).toBe(200);
    expect(setCurrentHouseholdForUserMock).toHaveBeenCalledWith(
      expect.anything(),
      "user-123",
      "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
      "Home"
    );
    expect(await response.json()).toEqual({
      id: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
      name: "Home",
      role: "owner",
      status: "active"
    });
  });
});
