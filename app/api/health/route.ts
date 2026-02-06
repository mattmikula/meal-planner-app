import { NextResponse } from "next/server";

import { jsonError, logApiError } from "@/lib/api/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("meals").select("id").limit(1);

    if (error) {
      logApiError("health GET", error);
      return jsonError("Health check failed.", 500);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("health GET", error);
    return jsonError("Health check failed.", 500);
  }
}
