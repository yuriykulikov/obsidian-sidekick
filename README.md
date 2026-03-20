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
- **Explore**: Sidekick pulls in relevant notes based on your prompts to broaden its understanding.
- **Edit**: (Planned) Transform and refine your content with AI assistance.

## Setup

1. Install dependencies: `npm install`
2. Configure your **Google Gemini API Key** in the plugin settings.
3. Open the Sidekick view from the ribbon icon (bot) or the command palette.

## Running

Run `npm run dev` in plugin dir which should be in `Vault/.obsidian/plugins`

## Security & Privacy

Sidekick uses the **Google Gemini API** (specifically the `gemini-3-flash-preview` model) to process your prompts and notes.
- Your data is only sent to Google when you interact with the agent.
- No data is collected or stored by the plugin developers.
- Refer to Google's privacy policy for how they handle API data.
- Sidekick defaults to reading only the notes you explicitly provide or that it discovers through links to answer your questions.
