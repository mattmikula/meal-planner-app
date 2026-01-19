import { describe, expect, it } from "vitest";

import {
  buildIngredientSuggestionRequest,
  parseIngredientList
} from "@/lib/ingredients/client";

describe("parseIngredientList", () => {
  it("rejects ingredients longer than 100 characters", () => {
    expect(parseIngredientList("a".repeat(101))).toEqual({
      ok: false,
      error: "Ingredient name must be 100 characters or less."
    });
  });

  it("dedupes case-insensitively and trims", () => {
    expect(parseIngredientList("Apple, apple,  banana , BANANA")).toEqual({
      ok: true,
      value: ["Apple", "banana"]
    });
  });
});

describe("buildIngredientSuggestionRequest", () => {
  it("rejects empty input", () => {
    expect(buildIngredientSuggestionRequest("   ")).toEqual({
      ok: false,
      error: "Enter at least one ingredient."
    });
  });

  it("builds requests from ingredient input", () => {
    expect(buildIngredientSuggestionRequest("Chicken, rice")).toEqual({
      ok: true,
      value: { ingredients: ["Chicken", "rice"] }
    });
  });
});
