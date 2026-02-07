"use client";

import { useRouter } from "next/navigation";
import {
  memo,
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
import { SessionStatusMessage } from "@/app/ui/StatusMessages";
import TextInput from "@/app/ui/TextInput";
import formStyles from "@/app/ui/FormControls.module.css";
import layoutStyles from "@/app/ui/Layout.module.css";
import styles from "@/app/groceries/Groceries.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import {
  buildCreateGroceryItemRequest,
  buildUpdateGroceryItemRequest
} from "@/lib/groceries/client";

type GroceryItem = components["schemas"]["GroceryItem"];

enum GroceriesStatusMessage {
  LoadFailed = "Unable to load grocery items.",
  ItemAdded = "Item added.",
  ItemAddFailed = "Unable to add item.",
  ItemUpdated = "Item updated.",
  ItemUpdateFailed = "Unable to update item.",
  ItemDeleted = "Item deleted.",
  ItemDeleteFailed = "Unable to delete item.",
  ItemChecked = "Item checked.",
  ItemUnchecked = "Item unchecked."
}

type GroceryFormProps = {
  name: string;
  quantity: string;
  isEditing: boolean;
  saving: boolean;
  onNameChange: (value: string) => void;
  onQuantityChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

const GroceryForm = memo(function GroceryForm({
  name,
  quantity,
  isEditing,
  saving,
  onNameChange,
  onQuantityChange,
  onSubmit,
  onCancel
}: GroceryFormProps) {
  return (
    <form onSubmit={onSubmit} className={layoutStyles.stack}>
      <div className={layoutStyles.stackSm}>
        <label htmlFor="grocery-name" className={formStyles.label}>
          Item name
        </label>
        <TextInput
          id="grocery-name"
          name="groceryName"
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          autoComplete="off"
          required
          maxLength={200}
          placeholder="Milk…"
        />
      </div>

      <div className={layoutStyles.stackSm}>
        <label htmlFor="grocery-quantity" className={formStyles.label}>
          Quantity (optional)
        </label>
        <TextInput
          id="grocery-quantity"
          name="groceryQuantity"
          type="text"
          value={quantity}
          onChange={(event) => onQuantityChange(event.target.value)}
          autoComplete="off"
          maxLength={100}
          placeholder="2 cartons…"
        />
      </div>

      <div className={layoutStyles.row}>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Update Item" : "Add Item"}
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

type GroceryListProps = {
  items: GroceryItem[];
  editingId: string | null;
  deletingId: string | null;
  saving: boolean;
  onEdit: (item: GroceryItem) => void;
  onDelete: (itemId: string) => void;
  onToggle: (item: GroceryItem) => void;
};

const GroceryList = memo(function GroceryList({
  items,
  editingId,
  deletingId,
  saving,
  onEdit,
  onDelete,
  onToggle
}: GroceryListProps) {
  return (
    <ul className={`${layoutStyles.stack} ${layoutStyles.list}`}>
      {items.map((item) => {
        const isChecked = item.checked;
        return (
          <li key={item.id}>
            <Card variant="compact" className={styles.itemCard}>
              <div className={styles.itemMeta}>
                <div className={styles.itemHeader}>
                  <strong className={isChecked ? styles.itemChecked : undefined}>
                    {item.name}
                  </strong>
                  {editingId === item.id ? (
                    <span className={layoutStyles.textMuted}>(editing)</span>
                  ) : null}
                </div>
                <p className={styles.itemQuantity}>
                  {item.quantity && item.quantity.trim() ? item.quantity : "No quantity noted."}
                </p>
              </div>
              <div className={styles.itemActions}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onToggle(item)}
                  disabled={saving || deletingId === item.id}
                >
                  {isChecked ? "Uncheck" : "Check"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onEdit(item)}
                  disabled={saving || deletingId === item.id}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onDelete(item.id)}
                  disabled={saving || deletingId === item.id}
                >
                  {deletingId === item.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
});

export default function GroceriesClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadItems = useCallback(async () => {
    if (isMountedRef.current) {
      setLoadingItems(true);
    }

    try {
      const { data, error, response } = await api.GET("/api/groceries");

      if (response?.status === 401) {
        router.replace("/");
        return false;
      }

      if (!response?.ok || !data) {
        if (isMountedRef.current) {
          setStatus(getApiErrorMessage(error) ?? GroceriesStatusMessage.LoadFailed);
        }
        return true;
      }

      if (isMountedRef.current) {
        setItems(data.items ?? []);
      }
    } catch {
      if (isMountedRef.current) {
        setStatus(GroceriesStatusMessage.LoadFailed);
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingItems(false);
      }
    }
    return true;
  }, [api, router]);

  useEffect(() => {
    let isMounted = true;

    const loadInitialItems = async () => {
      const authorized = await loadItems();
      if (isMounted && authorized) {
        setCheckingSession(false);
      }
    };

    loadInitialItems();

    return () => {
      isMounted = false;
    };
  }, [loadItems]);

  const resetForm = useCallback(() => {
    setFormName("");
    setFormQuantity("");
    setEditingId(null);
  }, []);

  const handleEdit = useCallback((item: GroceryItem) => {
    setStatus(null);
    setEditingId(item.id);
    setFormName(item.name ?? "");
    setFormQuantity(item.quantity ?? "");
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
          const updateResult = buildUpdateGroceryItemRequest(
            formName,
            formQuantity
          );
          if (!updateResult.ok) {
            setStatus(updateResult.error);
            return;
          }

          setSaving(true);
          const responsePayload = await api.PATCH("/api/groceries/{id}", {
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
                GroceriesStatusMessage.ItemUpdateFailed
            );
            return;
          }

          setStatus(GroceriesStatusMessage.ItemUpdated);
          resetForm();
          await loadItems();
          return;
        }

        const createResult = buildCreateGroceryItemRequest(formName, formQuantity);
        if (!createResult.ok) {
          setStatus(createResult.error);
          return;
        }

        setSaving(true);
        const responsePayload = await api.POST("/api/groceries", {
          body: createResult.value
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ?? GroceriesStatusMessage.ItemAddFailed
          );
          return;
        }

        setStatus(GroceriesStatusMessage.ItemAdded);
        resetForm();
        await loadItems();
      } catch {
        setStatus(
          editingId
            ? GroceriesStatusMessage.ItemUpdateFailed
            : GroceriesStatusMessage.ItemAddFailed
        );
      } finally {
        setSaving(false);
      }
    },
    [
      api,
      editingId,
      formName,
      formQuantity,
      loadItems,
      resetForm,
      router
    ]
  );

  const handleToggle = useCallback(
    async (item: GroceryItem) => {
      if (saving || deletingId) {
        return;
      }

      setStatus(null);
      setSaving(true);

      const nextChecked = !item.checked;

      try {
        const responsePayload = await api.PATCH("/api/groceries/{id}", {
          params: { path: { id: item.id } },
          body: { checked: nextChecked }
        });

        if (responsePayload.response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!responsePayload.response?.ok || !responsePayload.data) {
          setStatus(
            getApiErrorMessage(responsePayload.error) ??
              GroceriesStatusMessage.ItemUpdateFailed
          );
          return;
        }

        setItems((previous) =>
          previous.map((entry) => (entry.id === item.id ? responsePayload.data : entry))
        );
        setStatus(nextChecked ? GroceriesStatusMessage.ItemChecked : GroceriesStatusMessage.ItemUnchecked);
      } catch {
        setStatus(GroceriesStatusMessage.ItemUpdateFailed);
      } finally {
        setSaving(false);
      }
    },
    [api, deletingId, router, saving]
  );

  const handleDelete = useCallback(
    async (itemId: string) => {
      if (!window.confirm("Delete this item?")) {
        return;
      }

      setStatus(null);
      setDeletingId(itemId);

      try {
        const { data, error, response } = await api.DELETE("/api/groceries/{id}", {
          params: { path: { id: itemId } }
        });

        if (response?.status === 401) {
          router.replace("/");
          return;
        }

        if (!response?.ok || !data) {
          setStatus(
            getApiErrorMessage(error) ?? GroceriesStatusMessage.ItemDeleteFailed
          );
          return;
        }

        if (editingId === itemId) {
          resetForm();
        }

        setStatus(GroceriesStatusMessage.ItemDeleted);
        await loadItems();
      } catch {
        setStatus(GroceriesStatusMessage.ItemDeleteFailed);
      } finally {
        setDeletingId(null);
      }
    },
    [api, editingId, loadItems, resetForm, router]
  );

  if (checkingSession) {
    return (
      <PageLayout title="Groceries" size="wide" nav={<AppNav />}>
        <Card>
          <p>{SessionStatusMessage.Checking}</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Groceries"
      subtitle="Track household grocery needs."
      size="wide"
      nav={<AppNav />}
    >
      <Card className={layoutStyles.stack}>
        <h2>{editingId ? "Edit Item" : "Add a Grocery Item"}</h2>
        <GroceryForm
          name={formName}
          quantity={formQuantity}
          isEditing={Boolean(editingId)}
          saving={saving}
          onNameChange={setFormName}
          onQuantityChange={setFormQuantity}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </Card>

      <Card className={layoutStyles.stack}>
        <h2>Grocery List</h2>
        {loadingItems ? <p>Loading items…</p> : null}
        {!loadingItems && items.length === 0 ? (
          <p className={layoutStyles.textMuted}>
            No grocery items yet. Add your first one above.
          </p>
        ) : null}
        {!loadingItems && items.length > 0 ? (
          <GroceryList
            items={items}
            editingId={editingId}
            deletingId={deletingId}
            saving={saving}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
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
