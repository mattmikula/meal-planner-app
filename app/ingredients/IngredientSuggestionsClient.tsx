"use client";

import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import { SessionStatusMessage } from "@/app/ui/StatusMessages";
import TextArea from "@/app/ui/TextArea";
import formStyles from "@/app/ui/FormControls.module.css";
import layoutStyles from "@/app/ui/Layout.module.css";
import styles from "@/app/ingredients/Ingredients.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import { buildCreateIngredientItemsRequest } from "@/lib/groceries/client";
import { buildIngredientSuggestionRequest } from "@/lib/ingredients/client";

type IngredientSuggestion = components["schemas"]["IngredientSuggestion"];

enum IngredientStatusMessage {
  SessionLoadFailed = "Unable to load your session. Try again.",
  SuggestionFailed = "Unable to suggest a meal.",
  AddedToGroceries = "Ingredient added to groceries.",
  AddToGroceriesFailed = "Unable to add ingredient to groceries."
}

const MatchedIngredients = memo(function MatchedIngredients({
  ingredients,
  addingIngredient,
  addedIngredients,
  onAdd
}: {
  ingredients: string[];
  addingIngredient: string | null;
  addedIngredients: Set<string>;
  onAdd: (ingredient: string) => void;
}) {
  return (
    <ul className={styles.matchedList}>
      {ingredients.map((ingredient) => {
        const normalized = ingredient.toLowerCase();
        const isAdded = addedIngredients.has(normalized);
        const isAdding = addingIngredient === ingredient;
        return (
          <li key={ingredient} className={styles.matchedItem}>
            <span className={styles.matchedName}>{ingredient}</span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onAdd(ingredient)}
              disabled={isAdded || Boolean(addingIngredient)}
            >
              {isAdded ? "Added" : isAdding ? "Adding…" : "Add to Groceries"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
});

export default function IngredientSuggestionsClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const [ingredientsInput, setIngredientsInput] = useState("");
  const [suggestion, setSuggestion] = useState<IngredientSuggestion | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [addingIngredient, setAddingIngredient] = useState<string | null>(null);
  const [addedIngredients, setAddedIngredients] = useState<string[]>([]);

  const addedIngredientSet = useMemo(
    () => new Set(addedIngredients.map((ingredient) => ingredient.toLowerCase())),
    [addedIngredients]
  );

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      let authorized = true;
      try {
        const { response } = await api.GET("/api/me");
        if (!isMounted) {
          return;
        }

        if (response?.status === 401) {
          router.replace("/");
          authorized = false;
          return;
        }

        if (!response?.ok) {
          setStatus(IngredientStatusMessage.SessionLoadFailed);
        }
      } catch {
        if (isMounted) {
          setStatus(IngredientStatusMessage.SessionLoadFailed);
        }
      } finally {
        if (isMounted && authorized) {
          setCheckingSession(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [api, router]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatus(null);

      const request = buildIngredientSuggestionRequest(ingredientsInput);
      if (!request.ok) {
        setSuggestion(null);
        setAddedIngredients([]);
        setStatus(request.error);
        return;
      }

      setLoading(true);

      try {
        const responsePayload = await api.POST("/api/ingredients/suggest", {
          body: request.value
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setSuggestion(null);
          setStatus(
            getApiErrorMessage(responsePayload.error) ?? IngredientStatusMessage.SuggestionFailed
          );
          return;
        }

        setSuggestion(responsePayload.data);
        setAddedIngredients([]);
      } catch {
        setSuggestion(null);
        setStatus(IngredientStatusMessage.SuggestionFailed);
      } finally {
        setLoading(false);
      }
    },
    [api, ingredientsInput, router]
  );

  const handleAddIngredient = useCallback(
    async (ingredient: string) => {
      if (addingIngredient) {
        return;
      }

      setStatus(null);
      const payload = buildCreateIngredientItemsRequest(ingredient);
      if (!payload.ok) {
        setStatus(payload.error);
        return;
      }

      const [item] = payload.value;
      if (!item) {
        setStatus(IngredientStatusMessage.AddToGroceriesFailed);
        return;
      }

      setAddingIngredient(ingredient);

      try {
        const responsePayload = await api.POST("/api/groceries", {
          body: item
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              IngredientStatusMessage.AddToGroceriesFailed
          );
          return;
        }

        setAddedIngredients((previous) => [...previous, ingredient]);
        setStatus(IngredientStatusMessage.AddedToGroceries);
      } catch {
        setStatus(IngredientStatusMessage.AddToGroceriesFailed);
      } finally {
        setAddingIngredient(null);
      }
    },
    [addingIngredient, api, router]
  );

  if (checkingSession) {
    return (
      <PageLayout
        title="Ingredients"
        subtitle="Find meals from what you already have and add items to groceries."
        size="wide"
        nav={<AppNav />}
      >
        <Card>
          <p>{SessionStatusMessage.Checking}</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Ingredients"
      subtitle="Find meals from what you already have and add items to groceries."
      size="wide"
      nav={<AppNav />}
    >
      <Card className={layoutStyles.stack}>
        <h2>Find a Meal</h2>
        <form onSubmit={handleSubmit} className={layoutStyles.stack}>
          <div className={layoutStyles.stackSm}>
            <label htmlFor="ingredients-input" className={formStyles.label}>
              Available Ingredients
            </label>
            <TextArea
              id="ingredients-input"
              name="ingredients"
              value={ingredientsInput}
              onChange={(event) => setIngredientsInput(event.target.value)}
              autoComplete="off"
              maxLength={1000}
              placeholder="Chicken, rice, lime…"
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Finding…" : "Suggest Meal"}
          </Button>
        </form>
      </Card>

      <Card className={styles.suggestionCard}>
        <h2>Suggestion</h2>
        {suggestion ? (
          <div className={layoutStyles.stackSm}>
            <div className={layoutStyles.stackSm}>
              <strong>{suggestion.name}</strong>
              <p className={layoutStyles.textMuted}>
                Matched Ingredients ({suggestion.matchedIngredients.length})
              </p>
            </div>
            <MatchedIngredients
              ingredients={suggestion.matchedIngredients}
              addingIngredient={addingIngredient}
              addedIngredients={addedIngredientSet}
              onAdd={handleAddIngredient}
            />
          </div>
        ) : (
          <p className={layoutStyles.textMuted}>No suggestion yet. Enter ingredients above.</p>
        )}
      </Card>

      {status ? (
        <p className={layoutStyles.status} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </PageLayout>
  );
}
