import type { components } from "@/lib/api/types";

const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;

const NAME_REQUIRED_MESSAGE = "Name is required.";
const NAME_LENGTH_MESSAGE = "Name must be 200 characters or less.";
const NOTES_LENGTH_MESSAGE = "Notes must be 1000 characters or less.";
const UPDATE_REQUIRED_MESSAGE = "At least one field (name or notes) must be provided.";

type CreateMealRequest = components["schemas"]["CreateMealRequest"];
type UpdateMealRequest = components["schemas"]["UpdateMealRequest"];

type RequestResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const trimValue = (value: string) => value.trim();

export function buildCreateMealRequest(
  name: string,
  notes: string
): RequestResult<CreateMealRequest> {
  const trimmedName = trimValue(name);
  if (!trimmedName) {
    return { ok: false, error: NAME_REQUIRED_MESSAGE };
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_MESSAGE };
  }

  const trimmedNotes = trimValue(notes);
  if (trimmedNotes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: NOTES_LENGTH_MESSAGE };
  }

  const payload: CreateMealRequest = trimmedNotes
    ? { name: trimmedName, notes: trimmedNotes }
    : { name: trimmedName };

  return { ok: true, value: payload };
}

export function buildUpdateMealRequest(
  name: string,
  notes: string
): RequestResult<UpdateMealRequest> {
  const trimmedName = trimValue(name);
  const trimmedNotes = trimValue(notes);

  if (!trimmedName && !trimmedNotes) {
    return { ok: false, error: UPDATE_REQUIRED_MESSAGE };
  }

  if (trimmedName && trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_MESSAGE };
  }

  if (trimmedNotes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: NOTES_LENGTH_MESSAGE };
  }

  const payload: UpdateMealRequest = {};
  if (trimmedName) {
    payload.name = trimmedName;
  }
  payload.notes = trimmedNotes;

  return { ok: true, value: payload };
}
