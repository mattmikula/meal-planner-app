"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { createApiClient } from "@/lib/api/client";
import { getApiErrorMessage } from "@/lib/api/errors";

type InviteStatus = "idle" | "loading" | "accepted" | "needs-auth" | "error";
type InviteResult = { status: InviteStatus; message: string | null };

// Supabase OAuth tokens and our invite token that should be removed from URLs
const SENSITIVE_KEYS = ["access_token", "refresh_token", "invite_token"];

const MISSING_TOKEN_MESSAGE =
  "Invite token is missing. Please open the invite link again.";

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

  const inviteToken =
    getParam(hashParams, searchParams, "invite_token") ??
    getParam(hashParams, searchParams, "token");

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
      return { status: "accepted", message: null };
    }

    if (response?.status === 401) {
      return { status: "needs-auth", message: "Please sign in to accept this invite." };
    }

    return {
      status: "error",
      message: getApiErrorMessage(error) ?? "Unable to accept invite."
    };
  } catch {
    return { status: "error", message: "Unable to accept invite." };
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
  const [status, setStatus] = useState<InviteStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const cacheRef = useRef<CachedInvite>(null);

  useEffect(() => {
    let isMounted = true;

    const acceptInvite = async () => {
      const { inviteToken, accessToken, hasSensitive, cleanSearch, cleanHash } = readInviteParams();
      if (inviteToken) {
        cacheRef.current = { token: inviteToken };
      }

      const resolvedToken = inviteToken ?? cacheRef.current?.token;

      if (hasSensitive) {
        replaceUrl(window.location.pathname, cleanSearch, cleanHash);
      }

      if (!resolvedToken) {
        if (isMounted) {
          setStatus("error");
          setMessage(MISSING_TOKEN_MESSAGE);
        }
        return;
      }

      if (isMounted) {
        setStatus("loading");
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
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: "520px" }}>
      <h1>Meal Planner</h1>
      {status === "idle" || status === "loading" ? (
        <p>Accepting your invite...</p>
      ) : null}
      {status === "accepted" ? (
        <p>
          Your invite is accepted. You can return to the app.{" "}
          <Link href="/">Back to home</Link>
        </p>
      ) : null}
      {status === "needs-auth" ? (
        <p>
          {message} Sign in on the home page, then reopen the invite link.
        </p>
      ) : null}
      {status === "needs-auth" || status === "error" ? (
        <p>
          <Link href="/">Back to home</Link>
        </p>
      ) : null}
      {status === "error" ? <p>{message}</p> : null}
    </main>
  );
}
