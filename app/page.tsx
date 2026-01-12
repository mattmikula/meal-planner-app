"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function HomePage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      try {
        const response = await fetch("/api/me");
        if (!isMounted) {
          return;
        }
        if (response.ok) {
          const data = await response.json();
          setUserEmail(data.email ?? null);
          setOtpSent(false);
          return;
        }
        if (response.status === 401) {
          setUserEmail(null);
          return;
        }
        setStatus("Unable to load your session. Try again.");
      } catch {
        if (isMounted) {
          setStatus("Unable to load your session. Try again.");
        }
      } finally {
        if (isMounted) {
          setCheckingSession(false);
        }
      }
    };

    loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email
    });

    setLoading(false);

    if (error) {
      setStatus(error.message);
      return;
    }

    setOtpSent(true);
    setStatus("Enter the code we emailed you.");
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setVerifying(true);

    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: otpCode })
      });

      setVerifying(false);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data?.error ?? "Unable to verify the code. Try again.");
        return;
      }

      const data = await response.json();
      setUserEmail(data.email ?? null);
      setOtpCode("");
      setOtpSent(false);
      setStatus(null);
    } catch {
      setVerifying(false);
      setStatus("Unable to verify the code. Try again.");
    }
  };

  const handleLogout = async () => {
    setStatus(null);
    const response = await fetch("/api/logout", { method: "POST" });
    if (response.ok) {
      setUserEmail(null);
      setOtpSent(false);
      return;
    }
    setStatus("Unable to sign out. Try again.");
  };

  if (checkingSession) {
    return (
      <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "520px" }}>
        <h1>Meal Planner</h1>
        <p>Loading your session...</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "520px" }}>
      <h1>Meal Planner</h1>
      {!userEmail ? <p>Sign in with a one-time code to continue.</p> : null}

      {userEmail ? (
        <section>
          <p>Signed in as {userEmail}</p>
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
            onChange={(event) => {
              setEmail(event.target.value);
              if (otpSent) {
                setOtpSent(false);
                setOtpCode("");
              }
            }}
            required
            placeholder="you@example.com"
            style={{ padding: "0.5rem", width: "100%", marginBottom: "1rem" }}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send code"}
          </button>
        </form>
      )}

      {!userEmail && otpSent ? (
        <form onSubmit={handleVerify} style={{ marginTop: "1rem" }}>
          <label htmlFor="otp" style={{ display: "block", marginBottom: "0.5rem" }}>
            Verification code
          </label>
          <input
            id="otp"
            autoComplete="one-time-code"
            inputMode="numeric"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            required
            placeholder="123456"
            style={{ padding: "0.5rem", width: "100%", marginBottom: "1rem" }}
          />
          <button type="submit" disabled={verifying}>
            {verifying ? "Verifying..." : "Verify code"}
          </button>
        </form>
      ) : null}

      {status ? <p style={{ marginTop: "1rem" }}>{status}</p> : null}
    </main>
  );
}
