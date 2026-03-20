# Tools Registry

A management system for tools available to the agent. All tools in the registry are described to the agent during each
iteration of the loop, ensuring it always knows its current capabilities.

## Tool definitions

### `search_notes`

Searches for notes within the vault by matching titles or path names against a query. Returns a list of matching notes
as internal links, providing a way to discover specific notes when the exact name is unknown.

### `read_note`

Fetches a note's information, including its content, structure (headings), links, and backlinks. It can be used to
quickly scan a note's organization ('structure' mode) or read its full text ('text' mode). This tool is essential for
navigating the vault's knowledge graph.

