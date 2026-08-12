# Agent Session Model

Hub uses a one-to-many relationship:

```text
Agent definition/version 1 ──┬── Session A ── Runtime context A
                             ├── Session B ── Runtime context B
                             └── Session C ── Runtime context C
```

An Agent is the reusable control-plane definition: prompt, Skill bindings, Tool policy, and published version. A Session is one user conversation and one Runtime context. A Session must not change its `agent_id`; changing Agent or Agent version creates a new Session.

## UI flow

1. Open `Agents` and select an Agent.
2. Open `Playground`.
3. Create a Session from the left panel.
4. Send messages in the center panel. The selected Agent version is resolved before the Runtime run.
5. Create another Session to start an isolated conversation, or switch between existing Sessions.
6. Delete a Session when its Runtime context is no longer needed.

The right panel shows the binding that matters for debugging: Agent ID, pinned version, and current Session ID.

## Runtime contract

The Hub proxy forwards these Runtime endpoints:

- `POST /apps/{app}/users/{user}/sessions/{session}` creates or reuses a Runtime session and stores `agent_id`, `agent_version`, and `session_source` in state.
- `GET /apps/{app}/users/{user}/sessions` lists sessions for one Agent and user.
- `GET /apps/{app}/users/{user}/sessions/{session}` reads one session.
- `DELETE /apps/{app}/users/{user}/sessions/{session}` removes one Runtime context.
- `POST /run` executes a message against the selected session.

The UI retries only transient Runtime startup/DNS readiness failures. It does not retry authorization or validation errors.

## Lifecycle rule

Session history belongs to the Runtime session, not to the Agent definition. Publishing a new Agent version does not mutate existing Sessions. New conversations should be created against the new version; existing Sessions remain useful for audit and controlled continuation.

## Playground UX closure (2026-08-12)

- **History restore**: switching Sessions or refreshing the page no longer resets the chat. `AgentPlayground` calls `GET /apps/{app}/users/{user}/sessions/{session}` on mount/Session change and rebuilds the message list; `agent-workspace` no longer remounts the panel with `key={sessionId}`. Multiple messages per run are coalesced into one bubble per invocation, so tool calls/results stay inside the same turn instead of sprouting duplicate bubbles.
- **Streaming**: sending uses `POST /run_sse` via the Hub proxy (`/api/agent-runtime/run_sse`, SSE frames `data:` = one `models.Event` JSON, `adkRunDone` terminates). Sent text renders incrementally; `partial=true` frames append, final frames replace. If SSE fails, the client degrades to the non-streaming `POST /run` and reuses the same merge logic.
- **Rendering**: assistant text renders Markdown + GFM (tables, code fences) + syntax highlighting; `functionCall`/`functionResponse` parts render as collapsible tool cards with pretty-printed JSON instead of being merged raw into the transcript text. `react-markdown`, `remark-gfm` and `react-syntax-highlighter` (already in `package.json`) are now wired in.
- `runStream` supporting API lives in `src/lib/api/runtime.ts`; shared event→parts conversion and merge helpers live in `src/components/aihub/chat-message.tsx`.
