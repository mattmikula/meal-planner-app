"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import TextArea from "@/app/ui/TextArea";
import TextInput from "@/app/ui/TextInput";
import formStyles from "@/app/ui/FormControls.module.css";
import layoutStyles from "@/app/ui/Layout.module.css";
import styles from "@/app/meals/Meals.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import {
  buildCreateMealRequest,
  buildUpdateMealRequest
} from "@/lib/meals/client";

type Meal = components["schemas"]["Meal"];

enum MealsStatusMessage {
  LoadFailed = "Unable to load meals.",
  MealUpdated = "Meal updated.",
  MealUpdateFailed = "Unable to update meal.",
  MealAdded = "Meal added.",
  MealAddFailed = "Unable to add meal.",
  MealDeleted = "Meal deleted.",
  MealDeleteFailed = "Unable to delete meal."
}

type MealFormProps = {
  name: string;
  notes: string;
  imageUrl: string;
  ingredients: string;
  isEditing: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onImageUrlChange: (value: string) => void;
  onIngredientsChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const MealForm = memo(function MealForm({
  name,
  notes,
  imageUrl,
  ingredients,
  isEditing,
  saving,
  onNameChange,
  onNotesChange,
  onImageUrlChange,
  onIngredientsChange,
  onSubmit,
  onCancel
}: MealFormProps) {
  return (
    <form onSubmit={onSubmit} className={layoutStyles.stack}>
      <div className={layoutStyles.stackSm}>
        <label htmlFor="meal-name" className={formStyles.label}>
          Meal name
        </label>
        <TextInput
          id="meal-name"
          name="mealName"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
          required
          maxLength={200}
          placeholder="Tacos…"
        />
      </div>

      <div className={layoutStyles.stackSm}>
        <label htmlFor="meal-notes" className={formStyles.label}>
          Notes (optional)
        </label>
        <TextArea
          id="meal-notes"
          name="mealNotes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          autoComplete="off"
          maxLength={1000}
          placeholder="Any swaps or reminders…"
        />
      </div>

      <div className={layoutStyles.stackSm}>
        <label htmlFor="meal-image-url" className={formStyles.label}>
          Image URL (optional)
        </label>
        <TextInput
          id="meal-image-url"
          name="mealImageUrl"
          type="url"
          value={imageUrl}
          onChange={(event) => onImageUrlChange(event.target.value)}
          autoComplete="off"
          placeholder="https://example.com/meal.jpg…"
        />
      </div>

      <div className={layoutStyles.stackSm}>
        <label htmlFor="meal-ingredients" className={formStyles.label}>
          Ingredients (optional)
        </label>
        <TextArea
          id="meal-ingredients"
          name="mealIngredients"
          value={ingredients}
          onChange={(event) => onIngredientsChange(event.target.value)}
          autoComplete="off"
          maxLength={1000}
          placeholder="Chicken, rice, lime…"
        />
      </div>

      <div className={layoutStyles.row}>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Update Meal" : "Add Meal"}
        </Button>
        {isEditing ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
    </form>
  );
});

type MealListProps = {
  meals: Meal[];
  editingId: string | null;
  deletingId: string | null;
  saving: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
};

const MealList = memo(function MealList({
  meals,
  editingId,
  deletingId,
  saving,
  onEdit,
  onDelete
}: MealListProps) {
  return (
    <ul className={`${layoutStyles.stack} ${layoutStyles.list}`}>
      {meals.map((meal) => (
        <li key={meal.id}>
          <Card variant="compact" className={layoutStyles.stackSm}>
            <div className={`${layoutStyles.row} ${layoutStyles.rowBetween}`}>
              <div className={`${layoutStyles.stackSm} ${styles.mealMeta}`}>
                <div className={layoutStyles.row}>
                  <strong>{meal.name}</strong>
                  {editingId === meal.id ? (
                    <span className={layoutStyles.textMuted}>(editing)</span>
                  ) : null}
                </div>
                <p className={layoutStyles.textMuted}>
                  {meal.notes && meal.notes.trim() ? meal.notes : "No notes yet."}
                </p>
                <p className={layoutStyles.textMuted}>
                  {meal.ingredients.length > 0
                    ? `Ingredients: ${meal.ingredients.join(", ")}`
                    : "No ingredients yet."}
                </p>
              </div>
              {meal.imageUrl ? (
                <Image
                  src={meal.imageUrl}
                  alt={`Meal: ${meal.name}`}
                  className={styles.mealImage}
                  width={72}
                  height={72}
                  sizes="(max-width: 720px) 64px, 72px"
                  unoptimized
                />
              ) : null}
              <div className={layoutStyles.row}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onEdit(meal)}
                  disabled={saving || deletingId === meal.id}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(meal.id)}
                  disabled={saving || deletingId === meal.id}
                >
                  {deletingId === meal.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
});

export default function MealsClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formIngredients, setFormIngredients] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMeals = useCallback(async () => {
    if (isMountedRef.current) {
      setLoadingMeals(true);
    }

    try {
      const { data, error, response } = await api.GET("/api/meals");

      if (response?.status === 401) {
        router.replace("/");
        return false;
      }

      if (!response?.ok || !data) {
        if (isMountedRef.current) {
          setStatus(getApiErrorMessage(error) ?? MealsStatusMessage.LoadFailed);
        }
        return true;
      }

      if (isMountedRef.current) {
        setMeals(data.meals ?? []);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus(MealsStatusMessage.LoadFailed);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMeals(false);
      }
    }
    return true;
  }, [api, router]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialMeals = async () => {
      const authorized = await loadMeals();
      if (isMounted && authorized) {
        setCheckingSession(false);
      }
    };

    loadInitialMeals();

    return () => {
      isMounted = false;
    };
  }, [loadMeals, api, router]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormNotes("");
    setFormImageUrl("");
    setFormIngredients("");
    setEditingId(null);
  }, []);

  const handleEdit = useCallback((meal: Meal) => {
    setStatus(null);
    setEditingId(meal.id);
    setFormName(meal.name ?? "");
    setFormNotes(meal.notes ?? "");
    setFormImageUrl(meal.imageUrl ?? "");
    setFormIngredients(meal.ingredients.join(", "));
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
  }, [resetForm]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatus(null);

      try {
        if (editingId) {
          const updateResult = buildUpdateMealRequest(
            formName,
            formNotes,
            formImageUrl,
            formIngredients
          );
          if (!updateResult.ok) {
            setStatus(updateResult.error);
            return;
          }

          setSaving(true);
          const responsePayload = await api.PATCH("/api/meals/{id}", {
            params: { path: { id: editingId } },
            body: updateResult.value
          });

          if (responsePayload.response?.status === 401) {
            router.replace("/");
            return;
          }

          if (!responsePayload.response?.ok || !responsePayload.data) {
            setStatus(
              getApiErrorMessage(responsePayload.error) ??
                MealsStatusMessage.MealUpdateFailed
            );
            return;
          }

          setStatus(MealsStatusMessage.MealUpdated);
          resetForm();
          await loadMeals();
          return;
        }

        const createResult = buildCreateMealRequest(
          formName,
          formNotes,
          formImageUrl,
          formIngredients
        );
        if (!createResult.ok) {
          setStatus(createResult.error);
          return;
        }

        setSaving(true);
        const responsePayload = await api.POST("/api/meals", {
          body: createResult.value
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(getApiErrorMessage(responsePayload.error) ?? MealsStatusMessage.MealAddFailed);
          return;
        }

        setStatus(MealsStatusMessage.MealAdded);
        resetForm();
        await loadMeals();
      } catch {
        setStatus(
          editingId
            ? MealsStatusMessage.MealUpdateFailed
            : MealsStatusMessage.MealAddFailed
        );
      } finally {
        setSaving(false);
      }
    },
    [
      api,
      editingId,
      formName,
      formNotes,
      formImageUrl,
      formIngredients,
      loadMeals,
      resetForm,
      router
    ]
  );

  const handleDelete = useCallback(
    async (mealId: string) => {
      if (!window.confirm("Delete this meal?")) {
        return;
      }

      setStatus(null);
      setDeletingId(mealId);

      try {
        const { data, error, response } = await api.DELETE("/api/meals/{id}", {
          params: { path: { id: mealId } }
        });

        if (response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!response?.ok || !data) {
          setStatus(getApiErrorMessage(error) ?? MealsStatusMessage.MealDeleteFailed);
          return;
        }

        if (editingId === mealId) {
          resetForm();
        }

        setStatus(MealsStatusMessage.MealDeleted);
        await loadMeals();
      } catch {
        setStatus(MealsStatusMessage.MealDeleteFailed);
      } finally {
        setDeletingId(null);
      }
    },
    [api, editingId, loadMeals, resetForm, router]
  );

  if (checkingSession) {
    return (
      <PageLayout title="Meals" size="wide" nav={<AppNav />}>
        <Card>
          <p>Checking your session…</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Meals"
      subtitle="Manage the meals in your household list."
      size="wide"
      nav={<AppNav />}
    >
      <Card className={layoutStyles.stack}>
        <h2>{editingId ? "Edit Meal" : "Add a Meal"}</h2>
        <MealForm
          name={formName}
          notes={formNotes}
          imageUrl={formImageUrl}
          ingredients={formIngredients}
          isEditing={Boolean(editingId)}
          saving={saving}
          onNameChange={setFormName}
          onNotesChange={setFormNotes}
          onImageUrlChange={setFormImageUrl}
          onIngredientsChange={setFormIngredients}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Card>

      <Card className={layoutStyles.stack}>
        <h2>Meal List</h2>
        {loadingMeals ? <p>Loading meals…</p> : null}
        {!loadingMeals && meals.length === 0 ? (
          <p className={layoutStyles.textMuted}>No meals yet. Add your first one above.</p>
        ) : null}
        {!loadingMeals && meals.length > 0 ? (
          <MealList
            meals={meals}
            editingId={editingId}
            deletingId={deletingId}
            saving={saving}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : null}
      </Card>

      {status ? (
        <p className={layoutStyles.status} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </PageLayout>
  );
}
