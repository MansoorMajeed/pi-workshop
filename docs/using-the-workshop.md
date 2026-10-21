# Using the workshop

## Opening documents

`/workshop <file>` opens a Markdown file in your browser. The agent can do the same with its `workshop_open` tool, so you can also just ask for it.

If a workshop tab is already open, from this session or another one, the document opens in that tab instead of a new one. A tab with a half-written comment or an open source editor is never switched away: it shows a link to the new document instead.

The sidebar lists every open document from every running Pi session, grouped by session.

| Command | What it does |
|---|---|
| `/workshop <file>` | Open a document |
| `/workshop` | List open documents and their URLs |
| `/workshop close` | Stop the viewer for this session |

The viewer also stops when the session ends. Open tabs reconnect when a session comes back.

## Starting a thread

There are three ways to comment:

- **Select text** and click **Comment**. The thread is attached to exactly that text.
- **Click the +** next to a paragraph, list item, table row, heading or code block to comment on the whole block.
- **Click a label in a Mermaid diagram** to comment on that node or edge.

A new comment is a draft. Write as many as you like, then click **Send now** on one or **Send all**. Drafts survive a page refresh and resizing the window.

When you send a comment, the agent receives it in your Pi session as a message tagged `[workshop · <file> · thread #N]`, together with the section it's in, the exact text you selected and the text around it. That context means you can write "why this?" and the agent knows what "this" is.

## Talking it through

The agent answers in the thread, not in the terminal. Reply to continue the conversation, and resolve the thread when it's settled. A resolved thread collapses and stops highlighting its text; expand it any time to read it again.

The agent can start threads too. Ask it to review a document and it comments on the passages it has questions about, without changing the file. Those threads wait for your answer; nothing reaches the agent until you reply and send.

Each thread shows its state: **Draft**, **Waiting for reply**, **Replied**, **Review comment** (started by the agent) or **Resolved**.

## Where threads appear

On wide screens, threads sit in a rail to the right of the document, so the text stays readable. On narrow screens they appear inline, under the passage they belong to. Threads can be collapsed one at a time.

Click a thread to jump to its passage, or click a highlighted passage to jump to its thread. Both work with the keyboard: highlights are focusable, and Enter moves between them.

## When the document changes

The page refreshes live whenever the file changes, whoever changed it.

Each thread remembers the text it was started on:

- While that text is still in the document, the thread stays next to it and highlights it.
- If the text changed but its section is still there, the thread moves under the section heading, marked **Text changed**.
- If the whole section is gone, the thread moves to **Outdated threads** at the end of the page, marked **Outdated**.

When the agent rewrites the text a thread points at, it tells the thread where the text went, so the thread follows it.

## Editing in the browser

Click **Edit** to open the Markdown source. **Save** writes it back to the same file, and **Cancel** returns to the reading view (asking first if you have unsaved changes).

Editing is turn-based: while you write, the agent reviews without editing, and the other way round. There's no live co-editing or automatic merging. If the file changed after you opened the editor, Save refuses to overwrite it and offers two choices:

- **Overwrite with my version** replaces the other changes with yours.
- **Reload document** discards your draft and loads the current file.

Saving keeps the file's line endings and permissions. Documents over about 1 MiB can't be saved from the browser; edit those in your normal editor.

## Markdown features

Besides normal Markdown and tables, the workshop renders:

- **GitHub-style callouts:** `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]` and `> [!CAUTION]`.
- **Decision cards:** `> [!DECISION]` renders as a card you can comment on, which works well for the questions in a plan that need your call.
- **Mermaid diagrams:** fenced `mermaid` code blocks render as diagrams. Mermaid is bundled, so this works offline.

Raw HTML in a document is shown as text, never rendered.
