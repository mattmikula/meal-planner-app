"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { completeAuthCallback } from "@/lib/auth/callback";

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
