"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type AuthCallbackDeps = {
  supabase: ReturnType<typeof createBrowserSupabaseClient>;
  currentUrl: string;
  setStatus: (message: string) => void;
  replace: (path: string) => void;
};

export async function completeAuthCallback({
  supabase,
  currentUrl,
  setStatus,
  replace
}: AuthCallbackDeps) {
  const url = new URL(currentUrl);
  const code = url.searchParams.get("code");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      setStatus("Sign-in failed. Try again from the homepage.");
      return;
    }
  }

  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    setStatus("No session found. Try signing in again.");
    return;
  }

  setStatus("Signed in. Redirecting...");
  replace("/");
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    completeAuthCallback({
      supabase,
      currentUrl: window.location.href,
      setStatus,
      replace: router.replace
    });
  }, [router]);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Meal Planner</h1>
      <p>{status}</p>
    </main>
  );
}
