import { NextResponse } from "next/server";

import { logApiError } from "@/lib/api/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HEALTH_ERROR_MESSAGE = "Health check failed.";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("meals").select("id").limit(1);

    if (error) {
      logApiError("health GET", error);
      return NextResponse.json({ ok: false, error: HEALTH_ERROR_MESSAGE }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    logApiError("health GET", error);
    return NextResponse.json({ ok: false, error: HEALTH_ERROR_MESSAGE }, { status: 500 });
  }
}
