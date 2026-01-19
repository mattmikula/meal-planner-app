import { describe, expect, it } from "vitest";

import { buildPlanDayAssignments } from "@/lib/plans/server";

const baseDay = (overrides: Partial<Parameters<typeof buildPlanDayAssignments>[0][number]>) => ({
  id: "day-1",
  planId: "plan-1",
  date: "2024-02-12",
  mealId: null,
  leftoverFromPlanDayId: null,
  locked: false,
  createdAt: "2024-02-10T09:00:00Z",
  createdBy: "user-1",
  updatedAt: null,
  updatedBy: null,
  ...overrides
});

describe("buildPlanDayAssignments", () => {
  it("assigns meals to unlocked days and skips locked meals when possible", () => {
    const days = [
      baseDay({ id: "day-1", locked: true, mealId: "meal-a" }),
      baseDay({ id: "day-2", date: "2024-02-13" }),
      baseDay({ id: "day-3", date: "2024-02-14" })
    ];

    const assignments = buildPlanDayAssignments(days, ["meal-a", "meal-b", "meal-c"]);

    expect(assignments).toEqual([
      { id: "day-2", mealId: "meal-b" },
      { id: "day-3", mealId: "meal-c" }
    ]);
  });

  it("falls back to the full pool when all meals are locked", () => {
    const days = [
      baseDay({ id: "day-1", locked: true, mealId: "meal-a" }),
      baseDay({ id: "day-2", locked: true, mealId: "meal-b", date: "2024-02-13" }),
      baseDay({ id: "day-3", date: "2024-02-14" })
    ];

    const assignments = buildPlanDayAssignments(days, ["meal-a", "meal-b"]);

    expect(assignments).toEqual([{ id: "day-3", mealId: "meal-a" }]);
  });

  it("returns empty assignments when all days are locked", () => {
    const days = [
      baseDay({ id: "day-1", locked: true, mealId: "meal-a" }),
      baseDay({ id: "day-2", locked: true, mealId: "meal-b", date: "2024-02-13" })
    ];

    const assignments = buildPlanDayAssignments(days, ["meal-a", "meal-b"]);

    expect(assignments).toEqual([]);
  });

  it("skips days using leftovers", () => {
    const days = [
      baseDay({
        id: "day-1",
        leftoverFromPlanDayId: "day-0",
        mealId: "meal-leftover"
      }),
      baseDay({ id: "day-2", date: "2024-02-13" })
    ];

    const assignments = buildPlanDayAssignments(days, ["meal-a"]);

    expect(assignments).toEqual([{ id: "day-2", mealId: "meal-a" }]);
  });

  it("throws when no meals exist", () => {
    const days = [baseDay({ id: "day-1" })];

    expect(() => buildPlanDayAssignments(days, [])).toThrowError(
      "No meals available to generate a plan."
    );
  });
});
