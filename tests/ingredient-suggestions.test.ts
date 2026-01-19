import { describe, expect, it } from "vitest";

import { selectSuggestedMeal } from "@/lib/ingredients/server";

describe("selectSuggestedMeal", () => {
  it("selects the meal with the most matches", () => {
    const suggestion = selectSuggestedMeal(
      [
        { id: "meal-1", name: "Tacos", ingredients: ["chicken", "lime"] },
        { id: "meal-2", name: "Bowl", ingredients: ["chicken"] }
      ],
      ["chicken", "lime"]
    );

    expect(suggestion).toEqual({
      mealId: "meal-1",
      name: "Tacos",
      matchedIngredients: ["chicken", "lime"]
    });
  });

  it("breaks ties by meal name then id", () => {
    const suggestion = selectSuggestedMeal(
      [
        { id: "meal-2", name: "Apple Bowl", ingredients: ["rice"] },
        { id: "meal-1", name: "Apple Bowl", ingredients: ["rice"] },
        { id: "meal-3", name: "Berry Bowl", ingredients: ["rice"] }
      ],
      ["rice"]
    );

    expect(suggestion?.mealId).toBe("meal-1");
  });
});
