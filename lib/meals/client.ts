import type { components } from "@/lib/api/types";

const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 1000;

const NAME_REQUIRED_MESSAGE = "Name is required.";
const NAME_LENGTH_MESSAGE = "Name must be 200 characters or less.";
const NOTES_LENGTH_MESSAGE = "Notes must be 1000 characters or less.";
const IMAGE_URL_MESSAGE = "Image URL must be a valid URL.";
const UPDATE_REQUIRED_MESSAGE = "At least one field (name, notes, or imageUrl) must be provided.";

type CreateMealRequest = components["schemas"]["CreateMealRequest"];
type UpdateMealRequest = components["schemas"]["UpdateMealRequest"];

type RequestResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const trimValue = (value: string) => value.trim();

export function buildCreateMealRequest(
  name: string,
  notes: string,
  imageUrl: string
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

  const trimmedImageUrl = trimValue(imageUrl);
  if (trimmedImageUrl) {
    try {
      new URL(trimmedImageUrl);
    } catch {
      return { ok: false, error: IMAGE_URL_MESSAGE };
    }
  }

  const payload: CreateMealRequest = {
    name: trimmedName
  };

  if (trimmedNotes) {
    payload.notes = trimmedNotes;
  }

  if (trimmedImageUrl) {
    payload.imageUrl = trimmedImageUrl;
  }

  return { ok: true, value: payload };
}

export function buildUpdateMealRequest(
  name: string,
  notes: string,
  imageUrl: string
): RequestResult<UpdateMealRequest> {
  const trimmedName = trimValue(name);
  const trimmedNotes = trimValue(notes);
  const trimmedImageUrl = trimValue(imageUrl);

  if (!trimmedName && !trimmedNotes && !trimmedImageUrl) {
    return { ok: false, error: UPDATE_REQUIRED_MESSAGE };
  }

  if (trimmedName && trimmedName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: NAME_LENGTH_MESSAGE };
  }

  if (trimmedNotes.length > MAX_NOTES_LENGTH) {
    return { ok: false, error: NOTES_LENGTH_MESSAGE };
  }

  if (trimmedImageUrl) {
    try {
      new URL(trimmedImageUrl);
    } catch {
      return { ok: false, error: IMAGE_URL_MESSAGE };
    }
  }

  const payload: UpdateMealRequest = {};
  if (trimmedName) {
    payload.name = trimmedName;
  }

  payload.notes = trimmedNotes;

  if (imageUrl !== undefined) {
    payload.imageUrl = trimmedImageUrl ? trimmedImageUrl : null;
  }

  return { ok: true, value: payload };
}
