"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign-in...");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    const finalize = async () => {
      const currentUrl = window.location.href;
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
      router.replace("/");
    };

    finalize();
  }, [router]);

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <h1>Meal Planner</h1>
      <p>{status}</p>
    </main>
  );
}
