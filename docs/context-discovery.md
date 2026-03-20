# Context on Demand (Discovery)

Sidekick uses a **"Context on Demand"** approach to understanding your vault. Rather than indexing your entire vault
into a vector database, Sidekick discovers relevant notes dynamically using a set of specialized tools.

This discovery process is driven by the AI agent's reasoning. When you ask a question, the agent evaluates what
information it needs and uses its tools to navigate the vault's structure—following links, backlinks, and searching for
relevant titles.

## Philosophy: Structure over Embeddings

By relying on the natural architecture of your vault—links, tags, and hierarchy—Sidekick provides context that is:

- **Transparent**: You can see exactly which notes the agent used to form its answer.
- **Up-to-date**: There is no "index" to rebuild; the agent always sees the current state of your notes.
- **Privacy-respecting**: The agent only "reads" the notes it identifies as relevant to your specific query.

## How it works

1. **Initial Prompt**: You provide a prompt or a specific note to start with.
2. **Tool Selection**: The agent decides if it needs more information.
3. **Exploration**: The agent calls tools to "read" more notes, search for keywords, or list directories.
4. **Synthesis**: Once enough context is gathered, the agent provides a response based on the structured information it
   found.

## Discovery Tools

Sidekick currently uses the following tools to discover context:

- **`read_note`**: Fetches a note's structure, links, and backlinks. Content is also available upon request. Prioritize `structure` to save tokens and quickly understand organization.
- **`search_notes`**: Searches for notes by name/title. Returns a list of matching note titles.


