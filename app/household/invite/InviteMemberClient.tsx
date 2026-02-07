"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import AppNav from "@/app/ui/AppNav";
import Button from "@/app/ui/Button";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import { SessionStatusMessage } from "@/app/ui/StatusMessages";
import TextInput from "@/app/ui/TextInput";
import formStyles from "@/app/ui/FormControls.module.css";
import layoutStyles from "@/app/ui/Layout.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";
import type { components } from "@/lib/api/types";
import { normalizeEmail } from "@/lib/utils/email";

enum InviteMemberStatusMessage {
  EmailRequired = "Email is required.",
  HouseholdsLoadFailed = "Unable to load households.",
  InviteFailed = "Unable to create invite link.",
  InviteReady = "Invite link ready. Share it with your household member.",
  ClipboardUnavailable = "Your browser does not support automatic copying. Please copy the invite link manually.",
  ClipboardCopied = "Invite link copied to your clipboard.",
  ClipboardDenied = "Permission to access the clipboard was denied. Please allow clipboard access or copy the invite link manually.",
  ClipboardFailed = "Unable to copy the invite link automatically. Please copy it manually."
}

type HouseholdSummary = components["schemas"]["HouseholdSummary"];

const formatHouseholdName = (name: string | null) =>
  name && name.trim() ? name : "Untitled household";

export default function InviteMemberClient() {
  const api = useMemo(() => createApiClient(), []);
  const router = useRouter();
  const isMountedRef = useRef(true);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [households, setHouseholds] = useState<HouseholdSummary[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [loadingHouseholds, setLoadingHouseholds] = useState(true);

  useEffect(() => {
    isMountedRef.current = true;

    const loadHouseholds = async () => {
      setLoadingHouseholds(true);

      try {
        const { data, response, error } = await api.GET("/api/households");

        if (!isMountedRef.current) {
          return false;
        }

        if (response?.status === 401) {
          router.replace("/");
          return false;
        }

        if (!response?.ok || !data) {
          setStatus(getApiErrorMessage(error) ?? InviteMemberStatusMessage.HouseholdsLoadFailed);
          return true;
        }

        const selected =
          data.households.find((household) => household.isCurrent)?.id ??
          data.households[0]?.id ??
          "";

        setHouseholds(data.households);
        setHouseholdId(selected);
        return true;
      } catch {
        if (isMountedRef.current) {
          setStatus(InviteMemberStatusMessage.HouseholdsLoadFailed);
        }
        return true;
      } finally {
        if (isMountedRef.current) {
          setLoadingHouseholds(false);
        }
      }
    };

    const loadInitialData = async () => {
      const authorized = await loadHouseholds();
      if (isMountedRef.current && authorized) {
        setCheckingSession(false);
      }
    };

    loadInitialData();

    return () => {
      isMountedRef.current = false;
    };
  }, [api, router]);

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setInviteUrl(null);

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStatus(InviteMemberStatusMessage.EmailRequired);
      return;
    }

    setSending(true);

    try {
      const inviteBody = householdId
        ? { email: normalizedEmail, householdId }
        : { email: normalizedEmail };
      const { data, error, response } = await api.POST("/api/household/invites", {
        body: inviteBody
      });

      setSending(false);

      if (response?.status === 401) {
        router.replace("/");
        return;
      }

      if (!response?.ok || !data) {
        setStatus(getApiErrorMessage(error) ?? InviteMemberStatusMessage.InviteFailed);
        return;
      }

      setEmail("");
      setInviteUrl(data.inviteUrl);
      setStatus(InviteMemberStatusMessage.InviteReady);
    } catch {
      setSending(false);
      setStatus(InviteMemberStatusMessage.InviteFailed);
    }
  };

  const handleCopy = async () => {
    if (!inviteUrl) {
      return;
    }

    if (!navigator.clipboard?.writeText) {
      setStatus(InviteMemberStatusMessage.ClipboardUnavailable);
      return;
    }

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus(InviteMemberStatusMessage.ClipboardCopied);
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError")
      ) {
        setStatus(InviteMemberStatusMessage.ClipboardDenied);
      } else {
        setStatus(InviteMemberStatusMessage.ClipboardFailed);
      }
    }
  };

  if (checkingSession) {
    return (
      <PageLayout
        title="Invite a Household Member"
        subtitle="Create a shareable link to add someone to your household."
        size="narrow"
        nav={<AppNav />}
      >
        <Card>
          <p>{SessionStatusMessage.Checking}</p>
        </Card>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Invite a Household Member"
      subtitle="Create a shareable link to add someone to your household."
      size="narrow"
      nav={<AppNav />}
    >
      <div className={layoutStyles.stackLg}>
        <Card className={layoutStyles.stack}>
          <form onSubmit={handleInvite} className={layoutStyles.stack}>
            {households.length > 1 ? (
              <div className={layoutStyles.stackSm}>
                <label htmlFor="invite-household" className={formStyles.label}>
                  Household
                </label>
                <select
                  id="invite-household"
                  name="householdId"
                  className={formStyles.select}
                  value={householdId}
                  onChange={(event) => setHouseholdId(event.target.value)}
                  disabled={loadingHouseholds}
                >
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {formatHouseholdName(household.name)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className={layoutStyles.stackSm}>
              <label htmlFor="invite-email" className={formStyles.label}>
                Email
              </label>
              <TextInput
                id="invite-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                spellCheck={false}
                required
                placeholder="member@example.com…"
              />
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? "Creating link…" : "Create Invite Link"}
            </Button>
          </form>
        </Card>

        {inviteUrl ? (
          <Card className={layoutStyles.stack}>
            <div className={layoutStyles.stackSm}>
              <label htmlFor="invite-link" className={formStyles.label}>
                Shareable Invite Link
              </label>
              <TextInput
                id="invite-link"
                name="inviteLink"
                type="text"
                readOnly
                autoComplete="off"
                value={inviteUrl}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopy}
              aria-label="Copy invite link to clipboard"
            >
              Copy Link
            </Button>
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
