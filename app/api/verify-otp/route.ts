import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { applyAuthCookies, jsonError, validateRequest } from "@/lib/api/helpers";
import { verifyOtpSchema } from "@/lib/auth/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  const validation = validateRequest(body, verifyOtpSchema);
  if (!validation.success) {
    return validation.response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  const supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { data, error } = await supabase.auth.verifyOtp({
    email: validation.data.email,
    token: validation.data.token,
    type: "email"
  });

  if (error || !data.session || !data.user) {
    return jsonError("Invalid or expired code.", 401);
  }

  const response = NextResponse.json({
    id: data.user.id,
    email: data.user.email
  });
  applyAuthCookies(response, data.session, request);
  return response;
}
