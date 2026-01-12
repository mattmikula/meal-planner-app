import { NextResponse } from "next/server";

import { clearAuthCookies } from "@/lib/auth/server";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response, { secure: new URL(request.url).protocol === "https:" });
  return response;
}
