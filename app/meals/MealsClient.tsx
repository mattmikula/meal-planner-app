"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";

import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import {
  buildCreateMealRequest,
  buildUpdateMealRequest
} from "@/lib/meals/client";

type Meal = components["schemas"]["Meal"];

const pageStyle = {
  fontFamily: "system-ui",
  padding: "2rem",
  maxWidth: "720px"
} as const;

const sectionStyle = {
  marginTop: "2rem"
} as const;

const labelStyle = {
  display: "block",
  marginBottom: "0.5rem"
} as const;

const inputStyle = {
  padding: "0.5rem",
  width: "100%",
  marginBottom: "1rem"
} as const;

const textareaStyle = {
  padding: "0.5rem",
  width: "100%",
  marginBottom: "1rem",
  minHeight: "90px",
  resize: "vertical"
} as const;

const actionsStyle = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
  flexWrap: "wrap"
} as const;

const listStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0
} as const;

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: "8px",
  padding: "1rem",
  marginBottom: "1rem"
} as const;

const mutedTextStyle = {
  color: "#555"
} as const;

const statusStyle = {
  marginTop: "1.5rem"
} as const;

const SESSION_ERROR_MESSAGE = "Unable to confirm your session. Try again.";

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
    <form onSubmit={onSubmit}>
      <label htmlFor="meal-name" style={labelStyle}>
        Meal name
      </label>
      <input
        id="meal-name"
        type="text"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        required
        maxLength={200}
        placeholder="Tacos"
        style={inputStyle}
      />

      <label htmlFor="meal-notes" style={labelStyle}>
        Notes (optional)
      </label>
      <textarea
        id="meal-notes"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        maxLength={1000}
        placeholder="Any swaps or reminders"
        style={textareaStyle}
      />

      <div style={actionsStyle}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving..." : isEditing ? "Update meal" : "Add meal"}
        </button>
        {isEditing ? (
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel edit
          </button>
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
    <ul style={listStyle}>
      {meals.map((meal) => (
        <li key={meal.id} style={cardStyle}>
          <div style={actionsStyle}>
            <div>
              <strong>{meal.name}</strong>{" "}
              {editingId === meal.id ? (
                <span style={mutedTextStyle}>(editing)</span>
              ) : null}
            </div>
            <div style={actionsStyle}>
              <button
                type="button"
                onClick={() => onEdit(meal)}
                disabled={saving || deletingId === meal.id}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(meal.id)}
                disabled={saving || deletingId === meal.id}
              >
                {deletingId === meal.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
          <p style={mutedTextStyle}>
            {meal.notes && meal.notes.trim() ? meal.notes : "No notes yet."}
          </p>
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
        setStatus(getApiErrorMessage(error) ?? "Unable to load meals.");
        return;
      }

      if (isMountedRef.current) {
        setMeals(data.meals ?? []);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus("Unable to load meals.");
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

        setStatus(SESSION_ERROR_MESSAGE);
      } catch {
        if (isMounted) {
          setStatus(SESSION_ERROR_MESSAGE);
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

      const result = editingId
        ? buildUpdateMealRequest(formName, formNotes)
        : buildCreateMealRequest(formName, formNotes);

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      setSaving(true);

      try {
        const responsePayload = editingId
          ? await api.PATCH("/api/meals/{id}", {
              params: { path: { id: editingId } },
              body: result.value
            })
          : await api.POST("/api/meals", {
              body: result.value
            });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              (editingId ? "Unable to update meal." : "Unable to add meal.")
          );
          return;
        }

        setStatus(editingId ? "Meal updated." : "Meal added.");
        resetForm();
        await loadMeals();
      } catch {
        setStatus(editingId ? "Unable to update meal." : "Unable to add meal.");
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
          setStatus(getApiErrorMessage(error) ?? "Unable to delete meal.");
          return;
        }

        if (editingId === mealId) {
          resetForm();
        }

        setStatus("Meal deleted.");
        await loadMeals();
      } catch {
        setStatus("Unable to delete meal.");
      } finally {
        setDeletingId(null);
      }
    },
    [api, editingId, loadMeals, resetForm, router]
  );

  if (checkingSession) {
    return (
      <main style={pageStyle}>
        <h1>Meals</h1>
        <p>Checking your session...</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1>Meals</h1>
      <p>Manage the meals in your household list.</p>
      <p>
        <Link href="/">Back to home</Link>
      </p>

      <section style={sectionStyle}>
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
      </section>

      <section style={sectionStyle}>
        <h2>Meal list</h2>
        {loadingMeals ? <p>Loading meals...</p> : null}
        {!loadingMeals && meals.length === 0 ? (
          <p style={mutedTextStyle}>No meals yet. Add your first one above.</p>
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
      </section>

      {status ? (
        <p style={statusStyle} role="status" aria-live="polite">
          {status}
        </p>
      ) : null}
    </main>
  );
}
