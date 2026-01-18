import { describe, expect, it, vi } from "vitest";

import {
  PlanMutationError,
  updatePlanDay,
  updatePlanDaySchema
} from "@/lib/plans/server";

type SupabaseClient = Parameters<typeof updatePlanDay>[0];

describe("updatePlanDaySchema", () => {
  it("requires at least one field", () => {
    const result = updatePlanDaySchema.safeParse({});

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ message: "At least one field (mealId or locked) must be provided." }] }
    });
  });
});

describe("updatePlanDay", () => {
  it("returns null when plan day is missing", async () => {
    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null }))
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          return planDaysSelectQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-day-1",
      { locked: true }
    );

    expect(result).toBeNull();
  });

  it("throws when meal is not found in household", async () => {
    const planDayRow = {
      id: "plan-day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: null,
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    const mealsSelectQuery = {
      select: vi.fn(() => mealsSelectQuery),
      eq: vi.fn(() => mealsSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null }))
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          return planDaysSelectQuery;
        }
        if (table === "meals") {
          return mealsSelectQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    await expect(
      updatePlanDay(
        supabase as unknown as SupabaseClient,
        "household-1",
        "user-1",
        "plan-day-1",
        { mealId: "meal-missing" }
      )
    ).rejects.toBeInstanceOf(PlanMutationError);
  });

  it("updates the plan day when fields change", async () => {
    const planDayRow = {
      id: "plan-day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const updatedPlanDayRow = {
      ...planDayRow,
      locked: true,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    const planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    const plansUpdateQuery = {
      update: vi.fn(() => plansUpdateQuery),
      eq: vi.fn(() => plansUpdateQuery),
      then: (resolve: (value: { data: null; error: null }) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    const auditInsert = vi.fn(async () => ({ data: null, error: null }));

    let planDaysCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          planDaysCallCount += 1;
          return planDaysCallCount === 1 ? planDaysSelectQuery : planDaysUpdateQuery;
        }
        if (table === "plans") {
          return plansUpdateQuery;
        }
        if (table === "audit_log") {
          return { insert: auditInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-day-1",
      { locked: true }
    );

    expect(result?.locked).toBe(true);
    expect(auditInsert).toHaveBeenCalledTimes(1);
  });

  it("returns the existing plan day when no changes are applied", async () => {
    const planDayRow = {
      id: "plan-day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          return planDaysSelectQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    const result = await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-day-1",
      { locked: false }
    );

    expect(result?.locked).toBe(false);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("clears the meal assignment when mealId is null", async () => {
    const planDayRow = {
      id: "plan-day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const updatedPlanDayRow = {
      ...planDayRow,
      meal_id: null,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    const planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    const plansUpdateQuery = {
      update: vi.fn(() => plansUpdateQuery),
      eq: vi.fn(() => plansUpdateQuery),
      then: (resolve: (value: { data: null; error: null }) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    let planDaysCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          planDaysCallCount += 1;
          return planDaysCallCount === 1 ? planDaysSelectQuery : planDaysUpdateQuery;
        }
        if (table === "plans") {
          return plansUpdateQuery;
        }
        if (table === "audit_log") {
          return { insert: vi.fn(async () => ({ data: null, error: null })) };
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-day-1",
      { mealId: null }
    );

    expect(planDaysUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({ meal_id: null })
    );
  });

  it("writes two audit events when meal and lock change", async () => {
    const planDayRow = {
      id: "plan-day-1",
      plan_id: "plan-1",
      date: "2024-02-12",
      meal_id: "meal-1",
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const updatedPlanDayRow = {
      ...planDayRow,
      meal_id: null,
      locked: true,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    const planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    const planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    const plansUpdateQuery = {
      update: vi.fn(() => plansUpdateQuery),
      eq: vi.fn(() => plansUpdateQuery),
      then: (resolve: (value: { data: null; error: null }) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    const auditInsert = vi.fn(async () => ({ data: null, error: null }));

    let planDaysCallCount = 0;
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plan_days") {
          planDaysCallCount += 1;
          return planDaysCallCount === 1 ? planDaysSelectQuery : planDaysUpdateQuery;
        }
        if (table === "plans") {
          return plansUpdateQuery;
        }
        if (table === "audit_log") {
          return { insert: auditInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    await updatePlanDay(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "plan-day-1",
      { mealId: null, locked: true }
    );

    expect(auditInsert.mock.calls[0]?.[0]).toHaveLength(2);
  });
});
