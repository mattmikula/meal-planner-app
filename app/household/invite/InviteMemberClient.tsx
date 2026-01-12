"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";

const pageStyle = {
  fontFamily: "system-ui",
  padding: "2rem",
  maxWidth: "520px"
} as const;

const labelStyle = {
  display: "block",
  marginBottom: "0.5rem"
} as const;

const inputStyle = {
  padding: "0.5rem",
  width: "100%",
  marginBottom: "1rem"
} as const;

const statusStyle = {
  marginTop: "1rem"
} as const;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const SESSION_ERROR_MESSAGE = "Unable to confirm your session. Try again.";

export default function InviteMemberClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const { response } = await api.GET("/api/me");
        if (!isMounted) {
          return;
        }
        if (response?.ok) {
          setCheckingSession(false);
          return;
        }
        if (response?.status === 401) {
          router.replace("/");
          return;
        }
        setStatus(SESSION_ERROR_MESSAGE);
      } catch {
        if (isMounted) {
          setStatus(SESSION_ERROR_MESSAGE);
        }
      } finally {
        if (isMounted) {
          setCheckingSession(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [api, router]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setInviteUrl(null);

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStatus("Email is required.");
      return;
    }

    setSending(true);

    try {
      const { data, error, response } = await api.POST("/api/household/invites", {
        body: { email: normalizedEmail }
      });

      setSending(false);

      if (response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? "Unable to create invite link.");
        return;
      }

      setEmail("");
      setInviteUrl(data.inviteUrl);
      setStatus("Invite link ready. Share it with your household member.");
    } catch {
      setSending(false);
      setStatus("Unable to create invite link.");
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable.");
      }
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("Invite link copied to your clipboard.");
    } catch {
      setStatus("Unable to copy the invite link. Please copy it manually.");
    }
  };

  if (checkingSession) {
    return (
      <main style={pageStyle}>
        <h1>Invite a household member</h1>
        <p>Checking your session...</p>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <h1>Invite a household member</h1>
      <p>Create a shareable link to add someone to your household.</p>

      <form onSubmit={handleInvite}>
        <label htmlFor="invite-email" style={labelStyle}>
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          placeholder="member@example.com"
          style={inputStyle}
        />
        <button type="submit" disabled={sending}>
          {sending ? "Creating link..." : "Create invite link"}
        </button>
      </form>

      <p style={statusStyle}>
        <Link href="/">Back to home</Link>
      </p>

      {inviteUrl ? (
        <div style={statusStyle}>
          <label htmlFor="invite-link" style={labelStyle}>
            Shareable invite link
          </label>
          <input
            id="invite-link"
            type="text"
            readOnly
            value={inviteUrl}
            style={inputStyle}
          />
          <button type="button" onClick={handleCopy}>
            Copy link
          </button>
        </div>
      ) : null}

      {status ? (
        <p style={statusStyle} role="status">
          {status}
        </p>
      ) : null}
    </main>
  );
}
