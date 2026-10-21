# pi-workshop

Work through a plan or draft with your [Pi](https://pi.dev) agent, one passage at a time.

Chat is a single line: every side question pushes the main conversation further up, and the document you're actually working on ends up scattered across replies. pi-workshop opens the Markdown file in your browser instead, and lets you start a conversation on any part of it. Ask why a step is there, push back on a decision, suggest a rewrite: each thread stays attached to the text it's about, the agent answers in that thread, and the results go back into the file.

- **Comment on anything.** Select text, click the **+** beside a paragraph, list item, table row or heading, or click a label in a Mermaid diagram.
- **Keep many conversations going.** Threads sit beside the text they're about. Draft several, then send them one at a time or all at once.
- **Let the agent review too.** Ask for a review and the agent leaves its own comments on the passages it has questions about, for you to answer.
- **Take turns editing.** Edit the Markdown in the browser, or let the agent change the file. The page updates live and threads follow the text they point at.
- **Plans read well.** Callouts, decision cards, tables and Mermaid diagrams render properly, offline.

The Markdown file stays the real document. There's no export step and nothing to convert back.

## Install

```bash
pi install git:github.com/MansoorMajeed/pi-workshop
```

Tested with Pi 1.3.0. You need a desktop browser on the same machine as Pi.

## Use it

Open a file yourself:

```text
/workshop .scratch/plans/my-plan.md
```

Or just ask the agent: *"open the plan in the workshop"*, *"review my draft in the workshop"*. It has tools to open documents, comment on them and reply to your threads.

Then, in the browser:

1. Select a sentence and click **Comment**, or click the **+** next to any block.
2. Write your question or suggestion. It stays a draft until you click **Send now** or **Send all**.
3. The comment arrives in your Pi session. The agent replies in the thread, and edits the file if something should change.
4. Resolve the thread when you're done with it.

`/workshop` on its own lists open documents. `/workshop close` stops the viewer.

## Learn more

- [Using the workshop](docs/using-the-workshop.md): commenting, threads, editing, layout and Markdown features.
- [How the agent takes part](docs/agent-integration.md): the tools, what the agent receives, and how it should behave.
- [How it works](docs/how-it-works.md): the local server, security, where state is kept, and development.

## Coming from Clawd

This package used to ship inside [Clawd](https://github.com/MansoorMajeed/Clawd) as the "artifact viewer". The command is now `/workshop` and the tools are `workshop_open`, `workshop_comment` and `workshop_reply`. Your existing threads are copied from `~/.pi/agent/artifacts/` the first time you use it.

## License

Apache-2.0
