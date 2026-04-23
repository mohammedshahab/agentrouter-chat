"use client";

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Role = "user" | "assistant" | "system";

interface Message {
  id: string;
  role: Role;
  content: string;
  isError?: boolean;
}

const DEFAULT_MODEL = "gpt-5";
const AVAILABLE_MODELS = ["gpt-5", "glm-4.6", "glm-4.5", "deepseek-v3.1"];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRtl(text: string) {
  // Detect Arabic / Hebrew range to set direction per-bubble.
  return /[\u0590-\u08FF]/.test(text);
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [model, setModel] = useState(DEFAULT_MODEL);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  // Auto-resize textarea.
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: Message = {
        id: makeId(),
        role: "user",
        content: trimmed,
      };

      const history = [...messages, userMessage];
      setMessages(history);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: history.map(({ role, content }) => ({ role, content })),
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          const errMsg =
            (data && (data.error as string)) ||
            `حدث خطأ أثناء الاتصال بالخادم (HTTP ${res.status}).`;
          setMessages((prev) => [
            ...prev,
            {
              id: makeId(),
              role: "assistant",
              content: errMsg,
              isError: true,
            },
          ]);
          return;
        }

        const reply: string =
          (data && (data.content as string)) ||
          "لم يتم استلام رد من الذكاء الاصطناعي.";

        setMessages((prev) => [
          ...prev,
          { id: makeId(), role: "assistant", content: reply },
        ]);
      } catch (err) {
        const errMsg =
          err instanceof Error
            ? err.message
            : "تعذّر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.";
        setMessages((prev) => [
          ...prev,
          {
            id: makeId(),
            role: "assistant",
            content: errMsg,
            isError: true,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, model],
  );

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendMessage(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    if (isLoading) return;
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-dvh w-full">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-3xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white font-semibold">
              AR
            </div>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold">AgentRouter Chat</h1>
              <p className="text-xs text-[var(--muted)]">
                Powered by AgentRouter API
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="model" className="sr-only">
              Model
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="text-xs sm:text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
              disabled={isLoading}
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={clearChat}
              disabled={isLoading || messages.length === 0}
              className="text-xs sm:text-sm rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 hover:bg-[var(--surface-2)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              New chat
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="scroll-area flex-1 overflow-y-auto"
        aria-live="polite"
      >
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {messages.length === 0 && !isLoading && <EmptyState />}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {isLoading && <TypingIndicator />}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-[var(--border)] bg-[var(--background)]">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <div className="flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] focus-within:ring-2 focus-within:ring-[var(--accent)]/40 transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Type a message…  (Enter to send, Shift+Enter for newline)"
                rows={1}
                dir="auto"
                className="block w-full resize-none bg-transparent px-4 py-3 text-sm sm:text-base outline-none placeholder:text-[var(--muted)] max-h-[200px]"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="shrink-0 rounded-full bg-[var(--accent)] text-white p-3 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </form>
          <p className="mt-2 text-[11px] text-center text-[var(--muted)]">
            AI may produce inaccurate information. Verify important answers.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="mx-auto w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-xl font-semibold">
        AR
      </div>
      <h2 className="mt-4 text-xl font-semibold">How can I help you today?</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Ask anything. Your messages are sent to the AgentRouter API.
      </p>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const dir = isRtl(message.content) ? "rtl" : "ltr";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2 sm:gap-3`}
    >
      {!isUser && <Avatar role="assistant" />}
      <div
        dir={dir}
        className={[
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm sm:text-base whitespace-pre-wrap break-words leading-relaxed",
          isUser
            ? "bg-[var(--user-bubble)] text-[var(--user-bubble-fg)] rounded-br-sm"
            : message.isError
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 rounded-bl-sm"
              : "bg-[var(--assistant-bubble)] text-[var(--assistant-bubble-fg)] border border-[var(--border)] rounded-bl-sm",
        ].join(" ")}
      >
        {message.content}
      </div>
      {isUser && <Avatar role="user" />}
    </div>
  );
}

function Avatar({ role }: { role: Role }) {
  const isUser = role === "user";
  return (
    <div
      className={[
        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold",
        isUser
          ? "bg-[var(--user-bubble)] text-[var(--user-bubble-fg)]"
          : "bg-[var(--accent)] text-white",
      ].join(" ")}
      aria-hidden
    >
      {isUser ? "U" : "AI"}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 sm:gap-3">
      <Avatar role="assistant" />
      <div className="rounded-2xl px-4 py-3 bg-[var(--assistant-bubble)] border border-[var(--border)] rounded-bl-sm">
        <div className="flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="ml-2 text-xs text-[var(--muted)]">Typing…</span>
        </div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}
