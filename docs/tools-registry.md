# Tools Registry

A management system for tools available to the agent. All tools in the registry are described to the agent during each
iteration of the loop, ensuring it always knows its current capabilities.

## Tool definitions

The runtime catalog of tools is defined in the `AgentFactory.createAgentInstance()` method within
`src/agent-factory.ts`.

### `read_note`

Reads the full content of a note. Use this when you have a specific note name or path (e.g., from a link [[Note]] or a
search result) and need to understand its details.

### `read_note_links`

Reads the links and backlinks of a note. Use this when you need to understand the relationships between this note and
others in the vault. Once you have these links, use 'read_note', 'read_note_structure' or 'read_note_links' for direct
navigation.

### `read_note_structure`

Fetches a note's structure, including headings, links, and backlinks. Use this when you have a specific note name or
path (e.g., from a link [[Note]] or a search result) to quickly understand its organization and navigate to related
content without reading the full text.

### `search_by_tag`

Searches for notes that have a specific tag. Returns a list of matching paths.

### `search_notes`

Searches for notes and folders by name when you don't have a direct link. Returns a list of matching paths. Do NOT use
this if you already have a [[Link]] to the note you want to look up.

### `list_directory`

Lists files and folders at a specific path in the vault. Returns a markdown list with folder paths and file counts, and
file names.

### `grep_search`

Searches for a specific text string within all notes in the vault. Returns a list of matches including the file path and
surrounding lines of text for context. This is useful for finding specific information, mentions, or patterns across the
entire vault.

