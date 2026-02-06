import { NextResponse } from "next/server";

import { isSecureRequest } from "@/lib/api/helpers";
import { clearAuthCookies } from "@/lib/auth/server";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  const forwardedProto = request.headers.get("x-forwarded-proto");
  clearAuthCookies(response, { secure: isSecureRequest(request.url, forwardedProto) });
  return response;
}
