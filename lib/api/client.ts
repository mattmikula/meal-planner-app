import createClient from "openapi-fetch";

import type { paths } from "@/lib/api/types";

type ApiClientOptions = {
  baseUrl?: string;
  token?: string;
  fetch?: typeof fetch;
  headers?: HeadersInit;
};

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl = "", token, fetch: fetchImpl, headers } = options;
  const hasHeaders = Boolean(token || headers);
  const mergedHeaders = hasHeaders ? new Headers(headers) : undefined;
  if (mergedHeaders && token) {
    mergedHeaders.set("Authorization", `Bearer ${token}`);
  }

  return createClient<paths>({
    baseUrl,
    fetch: fetchImpl,
    headers: mergedHeaders
  });
}

export type ApiClient = ReturnType<typeof createApiClient>;
