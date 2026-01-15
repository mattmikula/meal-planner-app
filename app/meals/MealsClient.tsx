"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
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
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import {
  buildCreateMealRequest,
  buildUpdateMealRequest
} from "@/lib/meals/client";

type Meal = components["schemas"]["Meal"];

enum MealsStatusMessage {
  SessionError = "Unable to confirm your session. Try again.",
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
  isEditing: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

function MealForm({
  name,
  notes,
  isEditing,
  saving,
  onNameChange,
  onNotesChange,
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
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
          maxLength={200}
          placeholder="Tacos"
        />
      </div>

      <div className={layoutStyles.stackSm}>
        <label htmlFor="meal-notes" className={formStyles.label}>
          Notes (optional)
        </label>
        <TextArea
          id="meal-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          maxLength={1000}
          placeholder="Any swaps or reminders"
        />
      </div>

      <div className={layoutStyles.row}>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEditing ? "Update meal" : "Add meal"}
        </Button>
        {isEditing ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel edit
          </Button>
        ) : null}
      </div>
    </form>
  );
}

type MealListProps = {
  meals: Meal[];
  editingId: string | null;
  deletingId: string | null;
  saving: boolean;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
};

function MealList({
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
              <div className={layoutStyles.stackSm}>
                <div className={layoutStyles.row}>
                  <strong>{meal.name}</strong>
                  {editingId === meal.id ? (
                    <span className={layoutStyles.textMuted}>(editing)</span>
                  ) : null}
                </div>
                <p className={layoutStyles.textMuted}>
                  {meal.notes && meal.notes.trim() ? meal.notes : "No notes yet."}
                </p>
              </div>
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
                  {deletingId === meal.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

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
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadMeals = useCallback(async () => {
    setLoadingMeals(true);

    try {
      const { data, error, response } = await api.GET("/api/meals");

      if (response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? MealsStatusMessage.LoadFailed);
        return;
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
  }, [api, router]);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { response } = await api.GET("/api/me");
        if (!isMounted) {
          return;
        }

        if (response?.ok) {
          setCheckingSession(false);
          await loadMeals();
          return;
        }

        if (response?.status === 401) {
          router.replace("/");
          return;
        }

        setStatus(MealsStatusMessage.SessionError);
      } catch {
        if (isMounted) {
          setStatus(MealsStatusMessage.SessionError);
        }
      } finally {
        if (isMounted) {
          setCheckingSession(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [api, loadMeals, router]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormNotes("");
    setEditingId(null);
  }, []);

  const handleEdit = useCallback((meal: Meal) => {
    setStatus(null);
    setEditingId(meal.id);
    setFormName(meal.name ?? "");
    setFormNotes(meal.notes ?? "");
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
          const updateResult = buildUpdateMealRequest(formName, formNotes);
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

        const createResult = buildCreateMealRequest(formName, formNotes);
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
          <p>Checking your session...</p>
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
        <h2>{editingId ? "Edit meal" : "Add a meal"}</h2>
        <MealForm
          name={formName}
          notes={formNotes}
          isEditing={Boolean(editingId)}
          saving={saving}
          onNameChange={setFormName}
          onNotesChange={setFormNotes}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Card>

      <Card className={layoutStyles.stack}>
        <h2>Meal list</h2>
        {loadingMeals ? <p>Loading meals...</p> : null}
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
