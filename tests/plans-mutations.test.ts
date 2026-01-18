import { describe, expect, it, vi } from "vitest";

import {
  PlanMutationError,
  updatePlanDay,
  updatePlanDaySchema
} from "@/lib/plans/server";

type SupabaseClient = Parameters<typeof updatePlanDay>[0];

type PlanDayRow = {
  id: string;
  plan_id: string;
  date: string;
  meal_id: string | null;
  locked: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

type PlanDaySelectQuery = {
  select: () => PlanDaySelectQuery;
  eq: () => PlanDaySelectQuery;
  maybeSingle: () => Promise<{ data: PlanDayRow | null; error: null }>;
};

type PlanDayUpdateQuery = {
  update: () => PlanDayUpdateQuery;
  eq: () => PlanDayUpdateQuery;
  select: () => PlanDayUpdateQuery;
  maybeSingle: () => Promise<{ data: PlanDayRow | null; error: null }>;
};

type PlansUpdateQuery = {
  update: () => PlansUpdateQuery;
  eq: () => PlansUpdateQuery;
  then: (
    resolve: (value: { data: null; error: null }) => unknown,
    reject: (reason?: unknown) => unknown
  ) => Promise<unknown>;
};

type MealsSelectQuery = {
  select: () => MealsSelectQuery;
  eq: () => MealsSelectQuery;
  maybeSingle: () => Promise<{ data: { id: string } | null; error: null }>;
};

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
    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
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
    const planDayRow: PlanDayRow = {
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

    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    let mealsSelectQuery: MealsSelectQuery;
    mealsSelectQuery = {
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
    const planDayRow: PlanDayRow = {
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

    const updatedPlanDayRow: PlanDayRow = {
      ...planDayRow,
      locked: true,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    let planDaysUpdateQuery: PlanDayUpdateQuery;
    planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    let plansUpdateQuery: PlansUpdateQuery;
    plansUpdateQuery = {
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
    const planDayRow: PlanDayRow = {
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

    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
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
    const planDayRow: PlanDayRow = {
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

    const updatedPlanDayRow: PlanDayRow = {
      ...planDayRow,
      meal_id: null,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    let planDaysUpdateQuery: PlanDayUpdateQuery;
    planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    let plansUpdateQuery: PlansUpdateQuery;
    plansUpdateQuery = {
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
    const planDayRow: PlanDayRow = {
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

    const updatedPlanDayRow: PlanDayRow = {
      ...planDayRow,
      meal_id: null,
      locked: true,
      updated_at: "2024-02-18T01:20:00Z",
      updated_by: "user-1"
    };

    let planDaysSelectQuery: PlanDaySelectQuery;
    planDaysSelectQuery = {
      select: vi.fn(() => planDaysSelectQuery),
      eq: vi.fn(() => planDaysSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: planDayRow, error: null }))
    };

    let planDaysUpdateQuery: PlanDayUpdateQuery;
    planDaysUpdateQuery = {
      update: vi.fn(() => planDaysUpdateQuery),
      eq: vi.fn(() => planDaysUpdateQuery),
      select: vi.fn(() => planDaysUpdateQuery),
      maybeSingle: vi.fn(async () => ({ data: updatedPlanDayRow, error: null }))
    };

    let plansUpdateQuery: PlansUpdateQuery;
    plansUpdateQuery = {
      update: vi.fn(() => plansUpdateQuery),
      eq: vi.fn(() => plansUpdateQuery),
      then: (resolve: (value: { data: null; error: null }) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    const auditInsert = vi.fn(async (_payload: unknown[]) => ({ data: null, error: null }));

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

    const [auditPayload] = auditInsert.mock.calls[0] ?? [];
    expect(auditPayload).toHaveLength(2);
  });
});
