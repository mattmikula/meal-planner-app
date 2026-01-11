"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function HomePage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session ?? null);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Check your email for a magic link.");
  };

  const handleLogout = async () => {
    setStatus(null);
    await supabase.auth.signOut();
  };

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "520px" }}>
      <h1>Meal Planner</h1>
      <p>Sign in with a magic link to continue.</p>

      {session ? (
        <section>
          <p>Signed in as {session.user.email}</p>
          <button type="button" onClick={handleLogout}>
            Sign out
          </button>
        </section>
      ) : (
        <form onSubmit={handleLogin}>
          <label htmlFor="email" style={{ display: "block", marginBottom: "0.5rem" }}>
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
            style={{ padding: "0.5rem", width: "100%", marginBottom: "1rem" }}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send magic link"}
          </button>
        </form>
      )}

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </main>
  );
}
