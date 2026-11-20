import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "@/shared/api/schema";
import { ApiError, messageFromBody } from "@/shared/api/errors";
import { env } from "@/shared/config/env";
import { clearSession, getToken } from "@/shared/session/session-store";

const TIMEOUT_MS = 180_000;

const requestMiddleware: Middleware = {
  async onRequest({ request }) {
    const headers = new Headers(request.headers);
    const token = getToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const contentType = headers.get("content-type") ?? "";
    if (
      contentType.startsWith("multipart/form-data") &&
      !contentType.includes("boundary=")
    ) {
      headers.delete("content-type");
    }
    return new Request(request, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  },
};

const errorMiddleware: Middleware = {
  async onResponse({ request, response }) {
    if (response.ok) {
      return undefined;
    }
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 401 && request.headers.get("Authorization")) {
      clearSession();
    }
    throw new ApiError(
      response.status,
      messageFromBody(body, "The request failed."),
    );
  },
};

function createApiClient() {
  const client = createClient<paths>({ baseUrl: env.apiBaseUrl });
  client.use(requestMiddleware);
  client.use(errorMiddleware);
  return client;
}

export const apiClient = createApiClient();
