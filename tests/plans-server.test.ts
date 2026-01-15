import { describe, expect, it, vi } from "vitest";

import { fetchPlanForWeek, normalizeWeekStart, planFetchQuerySchema } from "@/lib/plans/server";

type SupabaseClient = Parameters<typeof fetchPlanForWeek>[0];

describe("planFetchQuerySchema", () => {
  it("requires weekStart", () => {
    const result = planFetchQuerySchema.safeParse({});

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ message: "Week start is required." }] }
    });
  });

  it("rejects non-YYYY-MM-DD formats", () => {
    const result = planFetchQuerySchema.safeParse({ weekStart: "2024/02/12" });

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ message: "Week start must be in YYYY-MM-DD format." }] }
    });
  });

  it("rejects invalid dates", () => {
    const result = planFetchQuerySchema.safeParse({ weekStart: "2024-02-30" });

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ message: "Week start must be a valid date." }] }
    });
  });

  it("trims whitespace around weekStart", () => {
    const result = planFetchQuerySchema.parse({ weekStart: " 2024-02-12 " });

    expect(result).toEqual({ weekStart: "2024-02-12" });
  });
});

describe("normalizeWeekStart", () => {
  it("normalizes to the Monday of the week", () => {
    expect(normalizeWeekStart("2024-02-14")).toBe("2024-02-12");
  });
});

describe("fetchPlanForWeek", () => {
  const buildSupabaseClient = (planDays: Array<{ date: string }>) => {
    const planRow = {
      id: "plan-1",
      week_start: "2024-02-12",
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    };

    const fullPlanDays = Array.from({ length: 7 }, (_, index) => ({
      id: `plan-day-${index + 1}`,
      plan_id: "plan-1",
      date: `2024-02-${String(12 + index).padStart(2, "0")}`,
      meal_id: null,
      locked: false,
      created_at: "2024-02-10T09:00:00Z",
      created_by: "user-1",
      updated_at: null,
      updated_by: null
    }));

    type PlansSelectQuery = {
      select: () => PlansSelectQuery;
      eq: () => PlansSelectQuery;
      maybeSingle: () => Promise<{ data: typeof planRow | null; error: null }>;
    };
    type PlansInsertQuery = {
      insert: () => PlansInsertQuery;
      select: () => PlansInsertQuery;
      single: () => Promise<{ data: typeof planRow; error: null }>;
    };
    type PlanDaysDatesQuery = {
      select: () => PlanDaysDatesQuery;
      eq: () => PlanDaysDatesQuery;
      then: (
        resolve: (value: { data: Array<{ date: string }>; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };
    type PlanDaysUpsertQuery = {
      upsert: (...args: unknown[]) => PlanDaysUpsertQuery;
      then: (
        resolve: (value: { data: null; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };
    type PlanDaysFetchQuery = {
      select: () => PlanDaysFetchQuery;
      eq: () => PlanDaysFetchQuery;
      in: () => PlanDaysFetchQuery;
      order: () => PlanDaysFetchQuery;
      then: (
        resolve: (value: { data: typeof fullPlanDays; error: null }) => unknown,
        reject: (reason?: unknown) => unknown
      ) => Promise<unknown>;
    };

    let plansSelectQuery: PlansSelectQuery;
    plansSelectQuery = {
      select: vi.fn(() => plansSelectQuery),
      eq: vi.fn(() => plansSelectQuery),
      maybeSingle: vi.fn(async () => ({ data: null, error: null }))
    };

    let plansInsertQuery: PlansInsertQuery;
    plansInsertQuery = {
      insert: vi.fn(() => plansInsertQuery),
      select: vi.fn(() => plansInsertQuery),
      single: vi.fn(async () => ({ data: planRow, error: null }))
    };

    let planDaysDatesQuery: PlanDaysDatesQuery;
    planDaysDatesQuery = {
      select: vi.fn(() => planDaysDatesQuery),
      eq: vi.fn(() => planDaysDatesQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: planDays, error: null }).then(resolve, reject)
    };

    let planDaysUpsertQuery: PlanDaysUpsertQuery;
    const planDaysUpsert = vi.fn((..._args: unknown[]) => planDaysUpsertQuery);
    planDaysUpsertQuery = {
      upsert: planDaysUpsert,
      then: (resolve, reject) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject)
    };

    let planDaysFetchQuery: PlanDaysFetchQuery;
    planDaysFetchQuery = {
      select: vi.fn(() => planDaysFetchQuery),
      eq: vi.fn(() => planDaysFetchQuery),
      in: vi.fn(() => planDaysFetchQuery),
      order: vi.fn(() => planDaysFetchQuery),
      then: (resolve, reject) =>
        Promise.resolve({ data: fullPlanDays, error: null }).then(resolve, reject)
    };

    let plansCallCount = 0;
    let planDaysCallCount = 0;

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "plans") {
          plansCallCount += 1;
          return plansCallCount === 1 ? plansSelectQuery : plansInsertQuery;
        }
        if (table === "plan_days") {
          planDaysCallCount += 1;
          if (planDaysCallCount === 1) {
            return planDaysDatesQuery;
          }
          if (planDaysCallCount === 2) {
            return planDaysUpsertQuery;
          }
          return planDaysFetchQuery;
        }
        throw new Error(`Unexpected table ${table}`);
      })
    };

    return {
      supabase,
      planDaysUpsert
    };
  };

  it("returns a full week of plan days", async () => {
    const { supabase } = buildSupabaseClient([]);

    const plan = await fetchPlanForWeek(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "2024-02-14"
    );

    expect(plan.days).toHaveLength(7);
    expect(plan.weekStart).toBe("2024-02-12");
  });

  it("upserts missing plan days", async () => {
    const { supabase, planDaysUpsert } = buildSupabaseClient([]);

    await fetchPlanForWeek(
      supabase as unknown as SupabaseClient,
      "household-1",
      "user-1",
      "2024-02-12"
    );

    const inserts = planDaysUpsert.mock.calls[0]?.[0] ?? [];
    expect(inserts).toHaveLength(7);
  });
});
