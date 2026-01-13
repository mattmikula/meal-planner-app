/**
 * Extracts error message from various error formats.
 * Handles native Error instances, objects with error/message properties, and nested errors.
 * Returns null if no error message can be extracted.
 */
export function getApiErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  // Handle native Error instances
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object") {
    const obj = error as { error?: unknown; message?: unknown };

    // Prefer a top-level message property if present
    if (typeof obj.message === "string" && obj.message) {
      return obj.message;
    }

    // Fallback to a top-level error property, which may itself be nested
    if ("error" in obj && obj.error !== undefined && obj.error !== null) {
      const nested = obj.error;

      if (typeof nested === "string" && nested) {
        return nested;
      }

      if (nested instanceof Error && nested.message) {
        return nested.message;
      }

      if (typeof nested === "object" && nested !== null && "message" in nested) {
        const nestedMessage = (nested as { message?: unknown }).message;
        if (typeof nestedMessage === "string" && nestedMessage) {
          return nestedMessage;
        }
      }
    }
  }

  return null;
}
