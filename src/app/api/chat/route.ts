import { NextRequest } from "next/server";

export const runtime = "nodejs";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages?: ChatMessage[];
  model?: string;
}

const AGENTROUTER_BASE_URL =
  process.env.AGENTROUTER_BASE_URL?.replace(/\/+$/, "") ||
  "https://agentrouter.org/v1";

const DEFAULT_MODEL = process.env.AGENTROUTER_MODEL || "gpt-5";

const SYSTEM_PROMPT =
  process.env.AGENTROUTER_SYSTEM_PROMPT ||
  "You are a helpful, concise assistant. Reply in the same language as the user.";

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.AGENTROUTER_API_KEY;
  if (!apiKey) {
    return jsonError(
      "AGENTROUTER_API_KEY is not configured on the server.",
      500,
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return jsonError("`messages` must be a non-empty array.", 400);
  }

  const sanitized: ChatMessage[] = [];
  for (const m of messages) {
    if (
      !m ||
      typeof m.content !== "string" ||
      (m.role !== "user" && m.role !== "assistant" && m.role !== "system")
    ) {
      return jsonError("Each message must have a role and string content.", 400);
    }
    sanitized.push({ role: m.role, content: m.content });
  }

  const hasSystem = sanitized.some((m) => m.role === "system");
  const finalMessages: ChatMessage[] = hasSystem
    ? sanitized
    : [{ role: "system", content: SYSTEM_PROMPT }, ...sanitized];

  const model =
    typeof body.model === "string" && body.model.trim().length > 0
      ? body.model.trim()
      : DEFAULT_MODEL;

  let upstream: Response;
  try {
    upstream = await fetch(`${AGENTROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        stream: false,
      }),
    });
  } catch (err) {
    return jsonError(
      `Network error contacting AgentRouter: ${
        err instanceof Error ? err.message : "unknown"
      }`,
      502,
    );
  }

  const rawText = await upstream.text();
  const contentType = upstream.headers.get("content-type") || "";
  const looksLikeJson =
    contentType.includes("application/json") ||
    rawText.trimStart().startsWith("{") ||
    rawText.trimStart().startsWith("[");

  if (!looksLikeJson) {
    return jsonError(
      "AgentRouter returned a non-JSON response (likely a WAF/CAPTCHA challenge). " +
        "Try again, switch network, or contact AgentRouter support.",
      502,
    );
  }

  let payload: unknown;
  try {
    payload = rawText ? JSON.parse(rawText) : {};
  } catch {
    return jsonError("Failed to parse AgentRouter response as JSON.", 502);
  }

  if (!upstream.ok) {
    const message = extractErrorMessage(payload, upstream.status);
    return jsonError(message, upstream.status);
  }

  const content = extractAssistantContent(payload);
  if (!content) {
    return jsonError(
      "AgentRouter returned a response with no message content.",
      502,
    );
  }

  return Response.json({ content, model });
}

function extractErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const err = obj.error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const eo = err as Record<string, unknown>;
      if (typeof eo.message === "string") return eo.message;
    }
    if (typeof obj.message === "string") return obj.message;
  }
  if (status === 401 || status === 403) {
    return "Authentication with AgentRouter failed. Check the API key.";
  }
  if (status === 429) {
    return "Rate limit reached or quota exhausted on AgentRouter.";
  }
  return `AgentRouter error (HTTP ${status}).`;
}

function extractAssistantContent(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string") return content;
  // Some providers return array of parts.
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const t = (part as Record<string, unknown>).text;
          if (typeof t === "string") return t;
        }
        return "";
      })
      .join("");
  }
  return null;
}
