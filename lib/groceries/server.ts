import "server-only";
import { z } from "zod";

import type { components, paths } from "@/lib/api/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SupabaseClient = ReturnType<typeof createServerSupabaseClient>;

export type GroceryItem = components["schemas"]["GroceryItem"];
export type GroceryIdParams = paths["/api/groceries/{id}"]["patch"]["parameters"]["path"];
export type CreateGroceryItemRequest = components["schemas"]["CreateGroceryItemRequest"];
export type UpdateGroceryItemRequest = components["schemas"]["UpdateGroceryItemRequest"];

type GroceryRow = {
  id: string;
  name: string;
  quantity: string | null;
  checked: boolean;
  created_at: string;
  created_by: string;
  updated_at: string | null;
  updated_by: string | null;
};

const NAME_REQUIRED_MESSAGE = "Item name is required.";
const NAME_LENGTH_MESSAGE = "Item name must be 200 characters or less.";
const QUANTITY_LENGTH_MESSAGE = "Quantity must be 100 characters or less.";
const UPDATE_REQUIRED_MESSAGE = "At least one field (name, quantity, or checked) must be provided.";

const normalizeQuantity = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const mapGroceryItem = (row: GroceryRow): GroceryItem => ({
  id: row.id,
  name: row.name,
  quantity: row.quantity,
  checked: row.checked,
  createdAt: row.created_at,
  createdBy: row.created_by,
  updatedAt: row.updated_at,
  updatedBy: row.updated_by
});

export const groceryIdParamSchema = z.object({
  id: z.string().uuid("Grocery item ID must be a valid UUID.")
}) satisfies z.ZodType<GroceryIdParams>;

export const createGroceryItemSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE).max(200, NAME_LENGTH_MESSAGE),
  quantity: z.string().max(100, QUANTITY_LENGTH_MESSAGE).optional(),
  checked: z.boolean().optional()
}) satisfies z.ZodType<CreateGroceryItemRequest>;

export const updateGroceryItemSchema = z.object({
  name: z.string().trim().min(1, NAME_REQUIRED_MESSAGE).max(200, NAME_LENGTH_MESSAGE).optional(),
  quantity: z.string().max(100, QUANTITY_LENGTH_MESSAGE).nullable().optional(),
  checked: z.boolean().optional()
}).refine(
  (data) => data.name !== undefined || data.quantity !== undefined || data.checked !== undefined,
  {
    message: UPDATE_REQUIRED_MESSAGE
  }
) satisfies z.ZodType<UpdateGroceryItemRequest>;

export type CreateGroceryItemInput = z.infer<typeof createGroceryItemSchema>;
export type UpdateGroceryItemInput = z.infer<typeof updateGroceryItemSchema>;

export async function listGroceries(
  supabase: SupabaseClient,
  householdId: string
): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, checked, created_at, created_by, updated_at, updated_by")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as GroceryRow[]).map(mapGroceryItem);
}

export async function createGroceryItem(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  input: CreateGroceryItemInput
): Promise<GroceryItem> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("grocery_items")
    .insert({
      household_id: householdId,
      name: input.name,
      quantity: normalizeQuantity(input.quantity),
      checked: input.checked ?? false,
      created_at: now,
      created_by: userId
    })
    .select("id, name, quantity, checked, created_at, created_by, updated_at, updated_by")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapGroceryItem(data as GroceryRow);
}

export async function updateGroceryItem(
  supabase: SupabaseClient,
  householdId: string,
  userId: string,
  itemId: string,
  input: UpdateGroceryItemInput
): Promise<GroceryItem | null> {
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    updated_at: now,
    updated_by: userId
  };

  if (input.name !== undefined) {
    updates.name = input.name;
  }

  if (input.quantity !== undefined) {
    updates.quantity = normalizeQuantity(input.quantity);
  }

  if (input.checked !== undefined) {
    updates.checked = input.checked;
  }

  const { data, error } = await supabase
    .from("grocery_items")
    .update(updates)
    .eq("id", itemId)
    .eq("household_id", householdId)
    .select("id, name, quantity, checked, created_at, created_by, updated_at, updated_by")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return mapGroceryItem(data as GroceryRow);
}

export async function deleteGroceryItem(
  supabase: SupabaseClient,
  householdId: string,
  itemId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("id", itemId)
    .eq("household_id", householdId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
