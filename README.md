# Sidekick

Sidekick is an AI agent for [Obsidian](https://obsidian.md), designed to be your companion in managing and growing your
knowledge base. Much like a coding agent for your vault, Sidekick treats Markdown as structured text and focuses on the
unique relationships within your Obsidian vault.

## Design Philosophy

For more information, see the [Design Document](docs/design-doc.md).

- **Structure-Based Context**: Sidekick treats Markdown as structured text. Instead of relying on embeddings or vector
  databases, it builds context through the natural architecture of your vault: links, backlinks, tags, tasks, and
  directory hierarchy.
- **Obsidian Native**: Sidekick uses the Obsidian API and vault structure, navigating your notes like a developer
  navigates a codebase.
- **Simple UI/UX**: Simple task-based interface.

## Interaction Modes

- **Ask**: Query your vault and get answers based on your notes.
- **Edit**: Transform and refine your content with AI assistance.
- **Explore**: Sidekick pulls in relevant notes based on your prompts to broaden its understanding.

## Running

Run `npm run dev` in plugin dir which should be in `Vault/.obsidian/plugins`
