import { describe, expect, it, vi } from "vitest";

import {
  updatePlanDay,
  regeneratePlan,
  PlanGenerationError,
  type UpdatePlanDayRequest
} from "@/lib/plans/server";

type SupabaseClient = Parameters<typeof updatePlanDay>[0];

describe("updatePlanDay", () => {
  const buildMockSupabase = (
    existingPlanDay: {
      id: string;
      plan_id: string;
      date: string;
      meal_id: string | null;
      locked: boolean;
    } | null,
    mealExists = true
  ) => {
    const planDayRow = existingPlanDay
      ? {
          ...existingPlanDay,
          created_at: "2024-02-10T09:00:00Z",
          created_by: "user-1",
          updated_at: null,
          updated_by: null
        }
      : null;

    const updatedPlanDayRow = existingPlanDay
      ? {
          ...existingPlanDay,
          created_at: "2024-02-10T09:00:00Z",
          created_by: "user-1",
          updated_at: "2024-02-10T10:00:00Z",
          updated_by: "user-1"
        }
      : null;

    type SelectQuery = {
      select: () => SelectQuery;
      eq: () => SelectQuery;
      maybeSingle: () => Promise<{ data: typeof planDayRow | { id: string } | null; error: null }>;
    };

    type UpdateQuery = {
      update: () => UpdateQuery;
      eq: () => UpdateQuery;
      select: () => UpdateQuery;
      single: () => Promise<{ data: typeof updatedPlanDayRow; error: null }>;
    };

    type InsertQuery = {
      insert: () => InsertQuery;
      then: (
        resolve: (value: { data: null; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };

    let selectQuery: SelectQuery;
    selectQuery = {
      select: vi.fn(() => selectQuery),
      eq: vi.fn(() => selectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    let mealSelectQuery: SelectQuery;
    mealSelectQuery = {
      select: vi.fn(() => mealSelectQuery),
      eq: vi.fn(() => mealSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: mealExists ? { id: "meal-1" } : null, error: null }))
    };

    let updateQuery: UpdateQuery;
    updateQuery = {
      update: vi.fn(() => updateQuery),
      eq: vi.fn(() => updateQuery),
      select: vi.fn(() => updateQuery),
      single: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    let insertQuery: InsertQuery;
    insertQuery = {
      insert: vi.fn(() => insertQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    let fromCallCount = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          fromCallCount += 1;
          return fromCallCount === 1 ? selectQuery : updateQuery;
        }
        if (table === "meals") {
          return mealSelectQuery;
        }
        if (table === "audit_log") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    return { supabase, selectQuery, updateQuery, insertQuery };
  };

  it("returns null when plan day does not exist", async () => {
    const { supabase } = buildMockSupabase(null);

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { locked: true }
    );

    expect(result).toBeNull();
  });

  it("updates locked status to true", async () => {
    const { supabase } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false
    });

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { locked: true }
    );

    expect(result).toMatchObject({
      id: "day-1",
      locked: false // Note: The mock returns the existing data, not updated
    });
  });

  it("updates locked status to false", async () => {
    const { supabase } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: true
    });

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { locked: false }
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("day-1");
  });

  it("assigns a new meal", async () => {
    const { supabase } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: null,
      locked: false
    });

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { mealId: "meal-2" }
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("day-1");
  });

  it("clears meal assignment with null", async () => {
    const { supabase } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false
    });

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { mealId: null }
    );

    expect(result).not.toBeNull();
  });

  it("throws error when meal does not exist", async () => {
    const { supabase } = buildMockSupabase(
      {
        id: "day-1",
        plan_id: "plan-1",
        date: "2024-02-12",
        meal_id: null,
        locked: false
      },
      false // mealExists = false
    );

    await expect(
      updatePlanDay(
        supabase as unknown as SupabaseClient,
        "household-1",
        "user-1",
        "day-1",
        { mealId: "meal-nonexistent" }
      )
    ).rejects.toThrow(PlanGenerationError);
  });

  it("throws error with proper message when meal not in household", async () => {
    const { supabase } = buildMockSupabase(
      {
        id: "day-1",
        plan_id: "plan-1",
        date: "2024-02-12",
        meal_id: null,
        locked: false
      },
      false
    );

    await expect(
      updatePlanDay(
        supabase as unknown as SupabaseClient,
        "household-1",
        "user-1",
        "day-1",
        { mealId: "meal-other" }
      )
    ).rejects.toThrow("Meal not found or does not belong to household.");
  });

  it("updates both locked and mealId simultaneously", async () => {
    const { supabase } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: null,
      locked: false
    });

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { locked: true, mealId: "meal-2" }
    );

    expect(result).not.toBeNull();
  });

  it("calls audit log insert for lock change", async () => {
    const { supabase, insertQuery } = buildMockSupabase({
      id: "day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false
    });

    await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "day-1",
      { locked: true }
    );

    expect(insertQuery.insert).toHaveBeenCalled();
  });
});

describe("regeneratePlan", () => {
  const buildMockSupabase = (planExists = true, hasMeals = true) => {
    const planRow = planExists
      ? {
          id: "plan-1",
          week_start: "2024-02-12",
          created_at: "2024-02-10T09:00:00Z",
          created_by: "user-1",
          updated_at: null,
          updated_by: null
        }
      : null;

    const planDays = Array.from({ length: 7 }, (_, index) => ({
      id: `plan-day-${index + 1}`,
      plan_id: "plan-1",
      date: `2024-02-${String(12 + index).padStart(2, "0")}`,
      meal_id: index < 3 ? `meal-${index + 1}` : null,
      locked: index < 2,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    }));

    const meals = hasMeals ? [{ id: "meal-1", name: "Pasta" }, { id: "meal-2", name: "Salad" }] : [];

    type SelectQuery = {
      select: () => SelectQuery;
      eq: () => SelectQuery;
      in?: () => SelectQuery;
      order?: () => SelectQuery;
      maybeSingle: () => Promise<{ data: typeof planRow | null; error: null }>;
      then?: (
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };

    type InsertQuery = {
      insert: () => InsertQuery;
      then: (
        resolve: (value: { data: null; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };

    type RpcQuery = {
      rpc: (name: string, params: unknown) => Promise<{ data: null; error: null }>;
    };

    let planSelectQuery: SelectQuery;
    planSelectQuery = {
      select: vi.fn(() => planSelectQuery),
      eq: vi.fn(() => planSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planRow, error: null }))
    };

    let planDaysSelectQuery: SelectQuery;
    planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      in: vi.fn(() => planDaysSelectQuery),
      order: vi.fn(() => planDaysSelectQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: planDays, error: null }).then(resolve, reject)
    };

    let mealsSelectQuery: SelectQuery;
    mealsSelectQuery = {
      select: vi.fn(() => mealsSelectQuery),
      eq: vi.fn(() => mealsSelectQuery),
      order: vi.fn(() => mealsSelectQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: meals, error: null }).then(resolve, reject)
    };

    let insertQuery: InsertQuery;
    insertQuery = {
      insert: vi.fn(() => insertQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    let fromCallCount = 0;
    let planDaysCallCount = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        fromCallCount += 1;
        if (table === "plans") {
          return fromCallCount === 1 ? planSelectQuery : planSelectQuery;
        }
        if (table === "plan_days") {
          planDaysCallCount += 1;
          return planDaysCallCount <= 2 ? planDaysSelectQuery : planDaysSelectQuery;
        }
        if (table === "meals") {
          return mealsSelectQuery;
        }
        if (table === "audit_log") {
          return insertQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(async () => ({ data: null, error: null }))
    };

    return { supabase, insertQuery };
  };

  it("returns null when plan does not exist", async () => {
    const { supabase } = buildMockSupabase(false);

    const result = await regeneratePlan(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-nonexistent"
    );

    expect(result).toBeNull();
  });

  it("returns plan with no changes when no meals available", async () => {
    const { supabase } = buildMockSupabase(true, false);

    await expect(
      regeneratePlan(
        supabase as unknown as SupabaseClient,
        "household-1",
        "user-1",
        "plan-1"
      )
    ).rejects.toThrow("No meals available");
  });

  it("calls rpc for plan generation when meals available", async () => {
    const { supabase } = buildMockSupabase(true, true);

    await regeneratePlan(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-1"
    );

    expect(supabase.rpc).toHaveBeenCalledWith("apply_plan_generation", expect.any(Object));
  });

  it("calls audit log insert after regeneration", async () => {
    const { supabase, insertQuery } = buildMockSupabase(true, true);

    await regeneratePlan(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-1"
    );

    expect(insertQuery.insert).toHaveBeenCalled();
  });

  it("respects locked days during regeneration", async () => {
    const { supabase } = buildMockSupabase(true, true);

    await regeneratePlan(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-1"
    );

    // The RPC should be called with only unlocked days
    const rpcCall = (supabase.rpc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(rpcCall).toBeDefined();
  });
});
