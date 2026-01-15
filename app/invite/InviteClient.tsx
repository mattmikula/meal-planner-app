"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import AppNav from "@/app/ui/AppNav";
import Card from "@/app/ui/Card";
import PageLayout from "@/app/ui/PageLayout";
import layoutStyles from "@/app/ui/Layout.module.css";
import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";

enum InviteStatus {
  Idle = "idle",
  Loading = "loading",
  Accepted = "accepted",
  NeedsAuth = "needs-auth",
  Error = "error"
}

enum InviteStatusMessage {
  MissingToken = "Invite token is missing. Please open the invite link again.",
  NeedsAuth = "Please sign in to accept this invite.",
  AcceptFailed = "Unable to accept invite."
}

type InviteResult = { status: InviteStatus; message: string | null };

// Supabase OAuth tokens that should be removed from URLs
const OAUTH_SENSITIVE_KEYS = ["access_token", "refresh_token"];
// Invite token parameter name - only this is valid for invite flows
const INVITE_TOKEN_KEY = "invite_token";
// All sensitive keys to remove from URLs
const SENSITIVE_KEYS = [...OAUTH_SENSITIVE_KEYS, INVITE_TOKEN_KEY];

const getParam = (
  hashParams: URLSearchParams,
  searchParams: URLSearchParams,
  key: string
) => hashParams.get(key) ?? searchParams.get(key);

const hasSensitiveParams = (
  hashParams: URLSearchParams,
  searchParams: URLSearchParams
) => SENSITIVE_KEYS.some((key) => hashParams.has(key) || searchParams.has(key));

/**
 * Builds a clean search string by removing sensitive parameters from both
 * search params and hash params. Returns the cleaned search string only
 * (hash is removed entirely if it contains sensitive data).
 */
const buildCleanSearch = (
  searchParams: URLSearchParams,
  hashParams: URLSearchParams
) => {
  const cleanParams = new URLSearchParams(searchParams);
  const cleanHash = new URLSearchParams(hashParams);
  SENSITIVE_KEYS.forEach((key) => {
    cleanParams.delete(key);
    cleanHash.delete(key);
  });
  const hashString = cleanHash.toString();
  return {
    search: cleanParams.toString(),
    hash: hashString ? `#${hashString}` : ""
  };
};

const readInviteParams = () => {
  const hash = window.location.hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  const inviteToken = getParam(hashParams, searchParams, INVITE_TOKEN_KEY);

  const accessToken = getParam(hashParams, searchParams, "access_token");

  const cleaned = buildCleanSearch(searchParams, hashParams);
  return {
    inviteToken,
    accessToken,
    hasSensitive: hasSensitiveParams(hashParams, searchParams),
    cleanSearch: cleaned.search,
    cleanHash: cleaned.hash
  };
};

/**
 * Replaces the current URL in browser history to remove sensitive parameters.
 *
 * SECURITY NOTE: While this removes sensitive tokens from the URL bar and prevents
 * them from appearing in subsequent history entries, the original URL with tokens
 * may still briefly appear in browser history before this replacement occurs.
 * This is a best-effort mitigation; the referrer policy ("no-referrer" in page.tsx)
 * provides additional protection against token leakage to external sites.
 */
const replaceUrl = (pathname: string, search: string, hash: string) => {
  const nextUrl = `${pathname}${search ? `?${search}` : ""}${hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl === currentUrl) {
    return;
  }
  window.history.replaceState(null, "", nextUrl);
};

type CachedInvite = {
  token: string;
  result?: InviteResult;
  promise?: Promise<InviteResult>;
} | null;

const acceptInviteToken = async (
  inviteToken: string,
  accessToken: string | null,
  cache: { current: CachedInvite }
): Promise<InviteResult> => {
  try {
    const api = createApiClient(accessToken ? { token: accessToken } : undefined);
    const { response, error } = await api.POST("/api/household/invites/accept", {
      body: { token: inviteToken }
    });

    if (response?.ok) {
      return { status: InviteStatus.Accepted, message: null };
    }

    if (response?.status === 401) {
      return { status: InviteStatus.NeedsAuth, message: InviteStatusMessage.NeedsAuth };
    }

    return {
      status: InviteStatus.Error,
      message: getApiErrorMessage(error) ?? InviteStatusMessage.AcceptFailed
    };
  } catch {
    return { status: InviteStatus.Error, message: InviteStatusMessage.AcceptFailed };
  }
};

/**
 * Gets the invite acceptance result, using cache to prevent duplicate API calls.
 *
 * Cache strategy:
 * - If we have a cached result for this token, return it immediately
 * - If we have an in-flight request for this token, return that promise (deduplication)
 * - Otherwise, start a new request and cache the promise
 * - Cache is invalidated if the token changes
 */
const getInviteResult = (
  inviteToken: string,
  accessToken: string | null,
  cache: { current: CachedInvite }
) => {
  // Check if we already have a result or in-flight request for this token
  if (cache.current?.token === inviteToken) {
    // Return cached result if available
    if (cache.current.result) {
      return Promise.resolve(cache.current.result);
    }
    // Return in-flight promise to avoid duplicate requests
    if (cache.current.promise) {
      return cache.current.promise;
    }
  }

  // Start a new request
  const promise = acceptInviteToken(inviteToken, accessToken, cache)
    .then((result) => {
      // Only cache result if token hasn't changed
      if (cache.current?.token === inviteToken) {
        cache.current.result = result;
        cache.current.promise = undefined;
      }
      return result;
    })
    .catch((error) => {
      // Clean up promise on error if token hasn't changed
      if (cache.current?.token === inviteToken) {
        cache.current.promise = undefined;
      }
      throw error;
    });

  cache.current = { token: inviteToken, promise };
  return promise;
};

export default function InviteClient() {
  const [status, setStatus] = useState<InviteStatus>(InviteStatus.Idle);
  const [message, setMessage] = useState<string | null>(null);
  const cacheRef = useRef<CachedInvite>(null);

  useEffect(() => {
    let isMounted = true;

    const acceptInvite = async () => {
      const { inviteToken, accessToken, hasSensitive, cleanSearch, cleanHash } = readInviteParams();
      // Only update cache if we have a new token (preserves in-flight requests in StrictMode)
      if (inviteToken && cacheRef.current?.token !== inviteToken) {
        cacheRef.current = { token: inviteToken };
      }

      const resolvedToken = inviteToken ?? cacheRef.current?.token;

      if (hasSensitive) {
        replaceUrl(window.location.pathname, cleanSearch, cleanHash);
      }

      if (!resolvedToken) {
        if (isMounted) {
          setStatus(InviteStatus.Error);
          setMessage(InviteStatusMessage.MissingToken);
        }
        return;
      }

      if (isMounted) {
        setStatus(InviteStatus.Loading);
      }

      const result = await getInviteResult(resolvedToken, accessToken, cacheRef);
      if (!isMounted) {
        return;
      }

      setStatus(result.status);
      setMessage(result.message);
    };

    acceptInvite();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <PageLayout title="Meal Planner" size="narrow" nav={<AppNav />}>
      <Card className={layoutStyles.stack}>
        {status === InviteStatus.Idle || status === InviteStatus.Loading ? (
          <p>Accepting your invite...</p>
        ) : null}
        {status === InviteStatus.Accepted ? (
          <p>
            Your invite is accepted. You can return to the app.{" "}
            <Link href="/">Back to home</Link>
          </p>
        ) : null}
        {status === InviteStatus.NeedsAuth ? (
          <p>
            {message} Sign in on the home page, then reopen the invite link.
          </p>
        ) : null}
        {status === InviteStatus.NeedsAuth || status === InviteStatus.Error ? (
          <p>
            <Link href="/">Back to home</Link>
          </p>
        ) : null}
        {status === InviteStatus.Error ? <p>{message}</p> : null}
      </Card>
    </PageLayout>
  );
}
