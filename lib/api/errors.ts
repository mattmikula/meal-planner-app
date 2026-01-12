export function getApiErrorMessage(error: unknown) {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "object" && "error" in error) {
    const message = (error as { error?: unknown }).error;
    return typeof message === "string" ? message : null;
  }

  return null;
}
