import { ApiError, messageFromBody } from "@/shared/api/errors";
import { env } from "@/shared/config/env";
import { clearSession, getToken } from "@/shared/session/session-store";

export type SseHandler = (event: string, data: Record<string, unknown>) => void;

export async function readPitchSse(
  response: Response,
  onEvent: SseHandler,
): Promise<void> {
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 401) {
      clearSession();
    }
    throw new ApiError(response.status, messageFromBody(body, "The request failed."));
  }
  if (!response.body) {
    throw new Error("The stream was empty.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    buffer = consumeSseBuffer(buffer, onEvent);
  }
  if (buffer.trim()) {
    consumeSseBuffer(`${buffer}\n\n`, onEvent);
  }
}

function consumeSseBuffer(buffer: string, onEvent: SseHandler): string {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const lines = part.split("\n");
    let event = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (!dataLines.length) {
      continue;
    }
    try {
      const data = JSON.parse(dataLines.join("\n")) as Record<string, unknown>;
      onEvent(event, data);
    } catch {
      onEvent(event, { raw: dataLines.join("\n") });
    }
  }
  return rest;
}

export async function createPitchStream(input: {
  message?: string;
  file?: File | null;
}): Promise<Response> {
  const token = getToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (input.file) {
    const body = new FormData();
    body.append("file", input.file);
    return fetch(`${env.apiBaseUrl}/v1/pitches`, {
      method: "POST",
      headers,
      body,
    });
  }
  headers.set("Content-Type", "application/json");
  return fetch(`${env.apiBaseUrl}/v1/pitches`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message: input.message ?? "" }),
  });
}

export async function postPitchMessageStream(
  pitchId: string,
  message: string,
): Promise<Response> {
  const token = getToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(`${env.apiBaseUrl}/v1/pitches/${pitchId}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
  });
}
