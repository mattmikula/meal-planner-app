import { describe, expect, it, vi } from "vitest";

import { acceptHouseholdInvite } from "@/lib/household/server";

describe("acceptHouseholdInvite", () => {
  it("sets the current household after accepting an invite", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "invite-1",
        household_id: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8",
        email: "test@example.com",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
        accepted_at: null
      },
      error: null
    });
    const rpcSingleMock = vi.fn().mockResolvedValue({
      data: { member_id: "member-1", error_code: null },
      error: null
    });

    const supabase = {
      from: (table: string) => {
        if (table === "household_invites") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: maybeSingleMock
              })
            })
          };
        }
        if (table === "user_household_settings") {
          return { upsert: upsertMock };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc: () => ({
        single: rpcSingleMock
      })
    };

    await acceptHouseholdInvite(
      supabase as unknown as ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>,
      "user-123",
      "test@example.com",
      { token: "token-value" }
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        current_household_id: "5f0f3d65-2d7a-4f60-9d5c-6df2b6fbe5e8"
      }),
      { onConflict: "user_id" }
    );
  });
});
