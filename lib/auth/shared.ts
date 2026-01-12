export const ACCESS_TOKEN_COOKIE = "meal-planner-access-token";
export const REFRESH_TOKEN_COOKIE = "meal-planner-refresh-token";

export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const prefix = `${name}=`;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    if (!part.startsWith(prefix)) {
      continue;
    }

    const value = part.slice(prefix.length);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}
