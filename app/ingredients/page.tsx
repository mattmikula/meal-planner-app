import type { Metadata } from "next";

import IngredientSuggestionsClient from "@/app/ingredients/IngredientSuggestionsClient";

export const metadata: Metadata = {
  title: "Ingredients",
  description: "Suggest meals from available ingredients."
};

export default function IngredientsPage() {
  return <IngredientSuggestionsClient />;
}
