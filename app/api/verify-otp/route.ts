import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/auth/server";

type VerifyPayload = {
  email?: string;
  token?: string;
};

export async function POST(request: Request) {
  let payload: VerifyPayload = {};

  try {
    payload = (await request.json()) as VerifyPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim();
  const token = payload.token?.trim();

  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
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
    email,
    token,
    type: "email"
  });

  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
  }

  const response = NextResponse.json({
    id: data.user.id,
    email: data.user.email
  });
  setAuthCookies(response, data.session, { secure: new URL(request.url).protocol === "https:" });
  return response;
}
