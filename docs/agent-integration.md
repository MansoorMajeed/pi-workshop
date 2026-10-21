# How the agent takes part

The workshop adds three tools to your Pi agent. Their descriptions tell the agent when to use them, so you rarely need to mention them by name.

## Tools

### `workshop_open`

Opens a Markdown document in the browser, reusing an open workshop tab if there is one.

| Parameter | Description |
|---|---|
| `path` | File path, relative to the working directory or absolute |

### `workshop_comment`

Starts a review thread on a passage, without editing the document or switching the browser. Use it when the user asks for a review: comments, not edits, unless they ask for revisions.

| Parameter | Description |
|---|---|
| `file` | Document path |
| `quote` | The exact text as it reads on the page (not Markdown syntax). It must identify one place in the document. |
| `text` | The comment, as plain text |
| `section` | Optional. A heading path (`Tasks › Phase 1`) or heading slug (`phase-1`), when the quote appears in more than one place |

The result includes the document's URL. If no workshop tab is showing the document, the result says so, and the agent should call `workshop_open` when the user should see the review.

A quote that matches nowhere, or more than once, is rejected with an error. The agent can quote more surrounding text, or pass a `section`. The section must match the heading the passage sits under exactly; a parent section doesn't match passages in its subsections.

### `workshop_reply`

Answers a thread. The reply appears in the browser under the user's comment.

| Parameter | Description |
|---|---|
| `file` | Document path, as shown in the thread header |
| `thread` | Thread number from the header |
| `text` | The reply, as plain text |
| `moved_to` | Optional. If the agent rewrote the text this thread points at, the new text as it reads on the page, so the thread stays attached |

Replies work even when the viewer isn't running; they're saved and appear the next time the document is opened.

## What the agent receives

Comments arrive in the session as an ordinary user message, one block per thread:

```text
[workshop · .scratch/plans/my-plan.md · thread #3]
Section: Plan › Rollout
Selected: "deploy to all regions at once"
Context: "…After the canary, deploy to all regions at once. Roll back if errors rise…"

Shouldn't this be staged by region?

Reply to each thread with workshop_reply (file: ".scratch/plans/my-plan.md"). …
```

Depending on the thread, a block can also include:

- `Diagram label` and `Mermaid source`, for comments on a diagram.
- `Current anchor`, after the agent has moved the thread with `moved_to`.
- `Agent review` and `User response`, when the user is answering a thread the agent started.

If the agent is busy when comments are sent, they're queued as a follow-up rather than interrupting it.

## Expected behaviour

The tool descriptions and the closing instruction in each message ask the agent to:

- **Answer in the thread.** The substance goes in `workshop_reply`. The terminal gets at most a short acknowledgment, so the conversation doesn't happen twice.
- **Edit the file when the document should change**, and pass `moved_to` when it rewrites text a thread points at.
- **Review with comments, not edits**, unless the user asks for revisions.
- **Take turns.** While the user is editing the source, the agent comments rather than editing, and the other way round.

## Using it from skills and prompts

A planning skill can write its plan to a file and call `workshop_open` so the user can read and comment on it in the browser. `> [!DECISION]` blocks render as cards the user can comment on, which works well for the questions that need the user's call.
