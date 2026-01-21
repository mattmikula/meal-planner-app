import { describe, expect, it, vi } from "vitest";

import { listHouseholdsForUser } from "@/lib/household/server";

describe("listHouseholdsForUser", () => {
  it("does not update current household when listing", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: { current_household_id: "missing-household" },
      error: null
    });

    const membersRows = [
      {
        id: "member-1",
        household_id: "household-1",
        role: "owner",
        status: "active",
        created_at: "2024-01-01T00:00:00Z",
        households: { id: "household-1", name: "Home" }
      }
    ];

    const supabase = {
      from: (table: string) => {
        if (table === "user_household_settings") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: maybeSingleMock
              })
            }),
            upsert: upsertMock
          };
        }
        if (table === "household_members") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    data: membersRows,
                    error: null
                  })
                })
              })
            })
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }
    };

    await listHouseholdsForUser(
      supabase as unknown as ReturnType<typeof import("@/lib/supabase/server").createServerSupabaseClient>,
      "user-123"
    );

    expect(upsertMock).not.toHaveBeenCalled();
  });
});
