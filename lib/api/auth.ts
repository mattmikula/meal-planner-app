import { NextResponse } from "next/server";

const BEARER_TOKEN_REGEX = /^bearer\s+/i;

export function getBearerToken(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !BEARER_TOKEN_REGEX.test(authHeader)) {
    return null;
  }

  const token = authHeader.replace(BEARER_TOKEN_REGEX, "").trim();
  return token || null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
