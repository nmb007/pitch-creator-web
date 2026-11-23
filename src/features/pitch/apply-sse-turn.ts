import type { ChatMessage, MatchItem } from "@/features/pitch/chat-types";

export type TurnPendingIds = {
  userId: string;
  assistantId: string;
};

export type SseTurnResult =
  | { kind: "messages"; messages: ChatMessage[] }
  | { kind: "matches"; matches: MatchItem[] }
  | { kind: "error"; detail: string }
  | { kind: "noop" };

export function applyPitchSseEvent(
  messages: ChatMessage[],
  eventName: string,
  data: Record<string, unknown>,
  ids: TurnPendingIds,
): SseTurnResult {
  if (eventName === "message.user" && typeof data.body === "string") {
    return {
      kind: "messages",
      messages: messages.map((row) => {
        if (row.id !== ids.userId) {
          return row;
        }
        const next: ChatMessage = {
          id: String(data.id ?? row.id),
          role: "user",
          body: String(data.body),
        };
        if (data.created_at) {
          next.created_at = String(data.created_at);
        } else if (row.created_at) {
          next.created_at = row.created_at;
        }
        return next;
      }),
    };
  }

  if (eventName === "assistant.delta" && typeof data.text === "string") {
    return {
      kind: "messages",
      messages: messages.map((row) =>
        row.id === ids.assistantId
          ? { ...row, body: `${row.body}${data.text}`, pending: true }
          : row,
      ),
    };
  }

  if (eventName === "assistant.message" && typeof data.body === "string") {
    return {
      kind: "messages",
      messages: messages.map((row) => {
        if (row.id !== ids.assistantId) {
          return row;
        }
        const next: ChatMessage = {
          id: String(data.id ?? row.id),
          role: "assistant",
          body: String(data.body),
        };
        if (data.created_at) {
          next.created_at = String(data.created_at);
        } else if (row.created_at) {
          next.created_at = row.created_at;
        }
        return next;
      }),
    };
  }

  if (eventName === "matches" && Array.isArray(data.items)) {
    return { kind: "matches", matches: data.items as MatchItem[] };
  }

  if (eventName === "error") {
    return {
      kind: "error",
      detail: String(data.detail ?? "The turn failed."),
    };
  }

  return { kind: "noop" };
}

export function seedTurnMessages(userText: string): {
  messages: ChatMessage[];
  ids: TurnPendingIds;
} {
  const sentAt = new Date().toISOString();
  const userId = `local-user-${Date.now()}`;
  const assistantId = `local-assistant-${Date.now()}`;
  return {
    ids: { userId, assistantId },
    messages: [
      {
        id: userId,
        role: "user",
        body: userText,
        created_at: sentAt,
      },
      {
        id: assistantId,
        role: "assistant",
        body: "",
        created_at: sentAt,
        pending: true,
      },
    ],
  };
}
