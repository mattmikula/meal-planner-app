import type { components } from "@/lib/api/types";

const MAX_NAME_LENGTH = 200;
const MAX_QUANTITY_LENGTH = 100;

const NAME_REQUIRED_MESSAGE = "Item name is required.";
const NAME_LENGTH_MESSAGE = "Item name must be 200 characters or less.";
const QUANTITY_LENGTH_MESSAGE = "Quantity must be 100 characters or less.";
const UPDATE_REQUIRED_MESSAGE = "At least one field (name, quantity, or checked) must be provided.";

type CreateGroceryItemRequest = components["schemas"]["CreateGroceryItemRequest"];
type UpdateGroceryItemRequest = components["schemas"]["UpdateGroceryItemRequest"];

type RequestResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const trimValue = (value: string) => value.trim();

export function buildCreateGroceryItemRequest(
  name: string,
  quantity: string
): RequestResult<CreateGroceryItemRequest> {
  const trimmedName = trimValue(name);
  if (!trimmedName) {
    return { ok: false, error: NAME_REQUIRED_MESSAGE };
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_MESSAGE };
  }

  const trimmedQuantity = trimValue(quantity);
  if (trimmedQuantity.length > MAX_QUANTITY_LENGTH) {
    return { ok: false, error: QUANTITY_LENGTH_MESSAGE };
  }

  const payload: CreateGroceryItemRequest = { name: trimmedName };
  if (trimmedQuantity) {
    payload.quantity = trimmedQuantity;
  }

  return { ok: true, value: payload };
}

export function buildUpdateGroceryItemRequest(
  name: string,
  quantity: string,
  checked?: boolean
): RequestResult<UpdateGroceryItemRequest> {
  const trimmedName = trimValue(name);
  const trimmedQuantity = trimValue(quantity);

  if (!trimmedName && !trimmedQuantity && checked === undefined) {
    return { ok: false, error: UPDATE_REQUIRED_MESSAGE };
  }

  if (trimmedName && trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_MESSAGE };
  }

  if (trimmedQuantity.length > MAX_QUANTITY_LENGTH) {
    return { ok: false, error: QUANTITY_LENGTH_MESSAGE };
  }

  const payload: UpdateGroceryItemRequest = {};
  if (trimmedName) {
    payload.name = trimmedName;
  }
  payload.quantity = trimmedQuantity ? trimmedQuantity : null;

  if (checked !== undefined) {
    payload.checked = checked;
  }

  return { ok: true, value: payload };
}
