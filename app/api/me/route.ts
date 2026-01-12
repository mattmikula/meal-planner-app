import { NextResponse } from "next/server";

import {
  getAccessToken,
  getRefreshToken,
  setAuthCookies,
  unauthorizedResponse
} from "@/lib/auth/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const token = getAccessToken(request);
  if (!token) {
    return unauthorizedResponse();
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    const refreshToken = getRefreshToken(request);
    if (!refreshToken) {
      return unauthorizedResponse();
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(
      { refresh_token: refreshToken }
    );

    if (refreshError || !refreshData.session || !refreshData.user) {
      return unauthorizedResponse();
    }

    const response = NextResponse.json({
      id: refreshData.user.id,
      email: refreshData.user.email
    });
    setAuthCookies(response, refreshData.session, {
      secure: new URL(request.url).protocol === "https:"
    });
    return response;
  }

  return NextResponse.json({
    id: data.user.id,
    email: data.user.email
  });
}
