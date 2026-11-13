# How it works

## The local server

Each Pi session that uses the workshop starts a small HTTP server on `127.0.0.1`. It serves the viewer page, an API for threads and source edits, and a live event stream that tells open tabs when something changed. The server starts the first time a workshop tool or command is used, and stops when the session ends or on `/workshop close`.

Each server tries ports 47851 to 47870 in order and falls back to a random port. Because the address is usually the same, a tab left open while you restart Pi reconnects on its own.

Servers record themselves in a registry so sessions can find each other. That is how the sidebar lists documents from every session, and how opening a document from one session can reuse a tab that another session opened. Entries for sessions that have exited are cleaned up automatically.

The server watches each open document's directory, so edits from any source (your editor, the agent, a `git checkout`) refresh the page.

## Security

The workshop is built so that only you, in your own browser, can send comments into your session:

- **Local only.** The server listens on `127.0.0.1` and checks the `Host` header, so other machines can't reach it.
- **Token required.** Every request needs a random 256-bit token, which is in the URL Pi opens. It's generated once per user and kept in `~/.pi/agent/workshop/token` (mode `0600`), so restarted servers accept tabs that are already open. Other websites open in your browser don't know the token, so they can't post comments into your session.
- **Nothing in a document runs.** Raw HTML in Markdown and all thread text are shown as text. A strict Content-Security-Policy allows only the viewer's own bundled scripts.
- **Only open documents can be written.** Source saves go only to files that were opened in the workshop, and only when the version matches what the editor loaded. Single-block saves replace only that block, and only if it is still in the file unchanged.

Comments you send become user messages in your session, and the agent acts on them like anything else you type. Treat the workshop URL like a password: anyone who has it can send messages to your agent while the server runs.

## Saving from the browser

A save writes the new content to a temporary file next to the document, restores the original file's permissions, checks once more that the document hasn't changed, and then renames the temporary file over it. If anything fails part-way, the original file is left untouched.

If the document is a symlink, the save goes to the file it points at and the symlink is kept. Because the file is replaced rather than rewritten in place, a hard link to the document keeps pointing at the old content, and extended attributes on the file aren't carried over.

A single-block save finds the block in the current file by its exact text. While the file is unchanged, it also uses which copy of identical blocks was opened; after a change, it only edits a block whose text was and still is unique. It copies every byte outside the block unchanged, so mixed line endings, a byte-order mark and trailing whitespace survive. New lines get the block's own line ending. It then parses the result and refuses the save if any other block would read differently.

Source and block saves are limited to 1 MiB per request, including JSON escaping.

## Where state is kept

Everything lives in `~/.pi/agent/workshop/`:

| Path | Contents |
|---|---|
| `threads/<sha1 of path>.json` | All threads for one document, keyed by its absolute path |
| `servers/<pid>-<port>.json` | Registry entries for running servers |
| `token` | The access token |

Threads are plain JSON and survive restarts. Moving or renaming a document starts it with no threads, since threads are keyed by path.

When the package first runs, it copies `threads/` from `~/.pi/agent/artifacts/`, where the Clawd "artifact viewer" kept them. The old directory is left in place. The copy happens only if `~/.pi/agent/workshop/threads/` doesn't exist yet.

## Development

```bash
npm install
npm test
```

The browser tests drive a real Chrome or Chromium through the DevTools protocol, with no extra npm dependencies. They're skipped unless you opt in:

```bash
npm run test:browser
```

They expect Google Chrome at its standard macOS path. Elsewhere, set `CHROME_BIN` to your browser executable. Set `WORKSHOP_SCREENSHOTS=1` to save screenshots of the editor and both layouts under `.scratch/`.

### Source layout

| File | Role |
|---|---|
| `src/index.ts` | Pi extension: tools, the `/workshop` command, lifecycle |
| `src/server.ts` | HTTP server, API, event stream and source saving |
| `src/render.ts` | Markdown to blocks of HTML, with callouts and Mermaid |
| `src/edit.ts` | Replacing one block's Markdown without touching the rest of the file |
| `src/anchor.ts` | Re-attaching threads to their text after the document changes |
| `src/store.ts` | Thread storage |
| `src/registry.ts` | Cross-session server registry |
| `src/message.ts` | The message sent to the agent |
| `src/assets/` | The browser client and its styles |
