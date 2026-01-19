import type { components } from "@/lib/api/types";

const MAX_INGREDIENT_LENGTH = 100;

const INGREDIENT_REQUIRED_MESSAGE = "Enter at least one ingredient.";
const INGREDIENT_LENGTH_MESSAGE = "Ingredient name must be 100 characters or less.";

type IngredientSuggestionRequest = components["schemas"]["IngredientSuggestionRequest"];

type RequestResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const splitIngredients = (rawInput: string) =>
  rawInput
    .split(/,|\n/)
    .map((value) => value.trim())
    .filter(Boolean);

export function parseIngredientList(
  rawInput: string,
  allowEmpty = false
): RequestResult<string[]> {
  const tokens = splitIngredients(rawInput);

  if (tokens.length === 0) {
    return allowEmpty ? { ok: true, value: [] } : { ok: false, error: INGREDIENT_REQUIRED_MESSAGE };
  }

  const seen = new Set<string>();
  const ingredients: string[] = [];

  for (const token of tokens) {
    if (token.length > MAX_INGREDIENT_LENGTH) {
      return { ok: false, error: INGREDIENT_LENGTH_MESSAGE };
    }

    const key = token.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    ingredients.push(token);
  }

  return { ok: true, value: ingredients };
}

export function buildIngredientSuggestionRequest(
  rawInput: string
): RequestResult<IngredientSuggestionRequest> {
  const parsed = parseIngredientList(rawInput, false);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: { ingredients: parsed.value } };
}
