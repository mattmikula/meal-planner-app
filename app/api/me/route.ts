import { NextResponse } from "next/server";

import { getBearerToken, unauthorizedResponse } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return unauthorizedResponse();
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return unauthorizedResponse();
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email
  });
}
