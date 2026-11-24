import { applyPitchSseEvent, type TurnPendingIds } from "@/features/pitch/apply-sse-turn";
import type { ChatMessage, MatchItem } from "@/features/pitch/chat-types";

export type LiveSseContext = {
  ids: TurnPendingIds;
  setMessages: (updater: (current: ChatMessage[]) => ChatMessage[]) => void;
  setMatches: (items: MatchItem[]) => void;
  setTurnStatus: (text: string | null) => void;
  setRunningTool: (name: string | null) => void;
  onMatches?: (items: MatchItem[]) => void;
};

function insertBeforePending(
  messages: ChatMessage[],
  pendingAssistantId: string,
  row: ChatMessage,
): ChatMessage[] {
  const idx = messages.findIndex((message) => message.id === pendingAssistantId);
  if (idx < 0) {
    return [...messages, row];
  }
  return [...messages.slice(0, idx), row, ...messages.slice(idx)];
}

export function handleLiveSseEvent(
  eventName: string,
  data: Record<string, unknown>,
  ctx: LiveSseContext,
): void {
  if (eventName === "status") {
    ctx.setTurnStatus(String(data.text ?? "Working on it...."));
    return;
  }

  if (eventName === "tool.selected") {
    ctx.setTurnStatus(null);
    const name = String(data.name ?? "tool");
    const args =
      data.args && typeof data.args === "object" && !Array.isArray(data.args)
        ? (data.args as Record<string, unknown>)
        : {};
    const callId = String(data.id ?? `call-${Date.now()}`);
    const body = JSON.stringify({
      tool_calls: [{ name, args, id: callId, type: "tool_call" }],
    });
    const row: ChatMessage = {
      id: `live-tool-call-${callId || Date.now()}`,
      role: "assistant",
      body,
      created_at: new Date().toISOString(),
    };
    ctx.setMessages((current) => insertBeforePending(current, ctx.ids.assistantId, row));
    return;
  }

  if (eventName === "tool.started") {
    ctx.setTurnStatus(null);
    ctx.setRunningTool(String(data.name ?? "tool"));
    return;
  }

  if (eventName === "tool.finished") {
    ctx.setRunningTool(null);
    ctx.setTurnStatus(null);
    const name = String(data.name ?? "tool");
    const body = String(data.body ?? `${name}: {}`);
    const row: ChatMessage = {
      id: `live-tool-result-${Date.now()}`,
      role: "tool",
      body,
      created_at: new Date().toISOString(),
    };
    ctx.setMessages((current) => insertBeforePending(current, ctx.ids.assistantId, row));
    return;
  }

  if (eventName === "matches" && Array.isArray(data.items)) {
    const items = data.items as MatchItem[];
    ctx.setMatches(items);
    ctx.onMatches?.(items);
    return;
  }

  if (eventName === "error") {
    throw new Error(String(data.detail ?? "The turn failed."));
  }

  ctx.setTurnStatus(null);
  ctx.setMessages((current) => {
    const result = applyPitchSseEvent(current, eventName, data, ctx.ids);
    return result.kind === "messages" ? result.messages : current;
  });
}
