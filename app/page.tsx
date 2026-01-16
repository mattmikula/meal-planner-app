"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import TextInput from "@/app/ui/TextInput";
import layoutStyles from "@/app/ui/Layout.module.css";
import formStyles from "@/app/ui/FormControls.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

enum HomeStatusMessage {
  SessionLoadFailed = "Unable to load your session. Try again.",
  OtpSent = "Enter the code we emailed you.",
  VerifyFailed = "Unable to verify the code. Try again.",
  SignOutFailed = "Unable to sign out. Try again."
}

export default function HomePage() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const api = useMemo(() => createApiClient(), []);
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
        const { data, response } = await api.GET("/api/me");
        if (!isMounted) {
          return;
        }
        if (response?.ok && data) {
          setUserEmail(data.email ?? null);
          setOtpSent(false);
          return;
        }
        if (response?.status === 401) {
          setUserEmail(null);
          return;
        }
        setStatus(HomeStatusMessage.SessionLoadFailed);
      } catch {
        if (isMounted) {
          setStatus(HomeStatusMessage.SessionLoadFailed);
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
  }, [api]);

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
    setStatus(HomeStatusMessage.OtpSent);
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setVerifying(true);

    try {
      const { data, error, response } = await api.POST("/api/verify-otp", {
        body: { email, token: otpCode }
      });

      setVerifying(false);

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? HomeStatusMessage.VerifyFailed);
        return;
      }

      setUserEmail(data.email ?? null);
      setOtpCode("");
      setOtpSent(false);
      setStatus(null);
    } catch {
      setVerifying(false);
      setStatus(HomeStatusMessage.VerifyFailed);
    }
  };

  const handleLogout = async () => {
    setStatus(null);
    const { error, response } = await api.POST("/api/logout");
    if (response?.ok) {
      setUserEmail(null);
      setOtpSent(false);
      return;
    }
    setStatus(getApiErrorMessage(error) ?? HomeStatusMessage.SignOutFailed);
  };

  const nav = !checkingSession && userEmail ? <AppNav /> : undefined;

  if (checkingSession) {
    return (
      <PageLayout title="Meal Planner" size="narrow" nav={nav}>
        <Card>
          <p>Loading your session…</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Meal Planner" size="narrow" nav={nav}>
      <div className={layoutStyles.stackLg}>
        <Card className={layoutStyles.stack}>
          {!userEmail ? <p>Sign in with a one-time code to continue.</p> : null}

          {userEmail ? (
            <div className={layoutStyles.stack}>
              <p>Signed in as {userEmail}</p>
              <p className={layoutStyles.textMuted}>
                Use the navigation to manage meals and invites.
              </p>
              <Button type="button" variant="secondary" onClick={handleLogout}>
                Sign Out
              </Button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className={layoutStyles.stack}>
              <div className={layoutStyles.stackSm}>
                <label htmlFor="email" className={formStyles.label}>
                  Email
                </label>
                <TextInput
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (otpSent) {
                      setOtpSent(false);
                      setOtpCode("");
                    }
                  }}
                  autoComplete="email"
                  spellCheck={false}
                  required
                  placeholder="you@example.com…"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send Code"}
              </Button>
            </form>
          )}
        </Card>

        {!userEmail && otpSent ? (
          <Card className={layoutStyles.stack}>
            <form onSubmit={handleVerify} className={layoutStyles.stack}>
              <div className={layoutStyles.stackSm}>
                <label htmlFor="otp" className={formStyles.label}>
                  Verification code
                </label>
                <TextInput
                  id="otp"
                  name="otp"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  spellCheck={false}
                  required
                  placeholder="123456…"
                />
              </div>
              <Button type="submit" disabled={verifying}>
                {verifying ? "Verifying…" : "Verify Code"}
              </Button>
            </form>
          </Card>
        ) : null}

        {status ? (
          <p className={layoutStyles.status} role="status" aria-live="polite">
            {status}
          </p>
        ) : null}
      </div>
    </PageLayout>
  );
}
