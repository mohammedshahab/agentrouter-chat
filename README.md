# AgentRouter Chat

A minimal, ChatGPT-like chat UI built with **Next.js 16 (App Router)**, **React 19**, **TypeScript** and **Tailwind CSS v4**, powered by the [AgentRouter](https://agentrouter.org/) OpenAI-compatible API.

Features:

- Clean ChatGPT-style chat layout, fully responsive
- Automatic light / dark mode (follows system preference)
- Distinct user / AI bubbles with avatars
- Auto-resizing input; **Enter** to send, **Shift+Enter** for newline
- Typing indicator while waiting for the AI
- Clear in-chat error messages on auth / quota / network failures
- Model picker (`gpt-5`, `glm-4.6`, `glm-4.5`, `deepseek-v3.1`)
- API key stays on the **server** — never exposed to the browser

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your API key

Copy the example env file and put your AgentRouter API key in it:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
AGENTROUTER_API_KEY=sk-your-real-key-here
```

> Get a key from https://agentrouter.org/console/token

Optional overrides:

| Variable                     | Default                       | Purpose                                  |
| ---------------------------- | ----------------------------- | ---------------------------------------- |
| `AGENTROUTER_BASE_URL`       | `https://agentrouter.org/v1`  | OpenAI-compatible base URL               |
| `AGENTROUTER_MODEL`          | `gpt-5`                       | Default model used by the `/api/chat` route |
| `AGENTROUTER_SYSTEM_PROMPT`  | helpful-assistant prompt      | System prompt prepended to every chat    |

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000> and start chatting.

### 4. Production build

```bash
npm run build
npm start
```

---

## How it works

```
Browser  ──fetch──►  /api/chat  ──fetch──►  https://agentrouter.org/v1/chat/completions
   ▲                    │                              │
   └────── JSON ────────┴──────── Bearer <KEY> ────────┘
```

- The browser **never** sees your API key — it only talks to your own `/api/chat` route.
- The server route forwards the message history to AgentRouter's OpenAI-compatible
  `chat/completions` endpoint with `Authorization: Bearer <AGENTROUTER_API_KEY>`.
- The assistant's reply is extracted from `choices[0].message.content` and returned
  to the client.
- HTTP errors from AgentRouter (401, 403, 429, etc.) are translated into friendly
  messages that show up as a red error bubble in the chat.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts        # Server route: proxies requests to AgentRouter
│   ├── globals.css             # Tailwind + design tokens (light/dark)
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Mounts the <Chat/> component
└── components/
    └── Chat.tsx                # Client component: chat UI + state
```

## Security notes

- Never commit `.env.local`; it is git-ignored by default.
- If you previously shared an API key publicly, **revoke it immediately** in the
  AgentRouter console and generate a fresh one.

## License

MIT
