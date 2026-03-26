# Tools Registry

A management system for tools available to the agent. All tools in the registry are described to the agent during each
iteration of the loop, ensuring it always knows its current capabilities.

## Tool definitions

The runtime catalog of tools is defined in the `AgentFactory.createAgentInstance()` method within
`src/agent-factory.ts`.

### `search_notes`

Searches for notes and folders within the vault by matching names against a query. Returns a list of matching paths,
providing a way to discover specific notes or folders when the exact name or location is unknown.

### `read_note`

Reads the full content of a note. Use this when you need to understand the details of a note, quote from it, or analyze
its content in depth.

### `read_note_structure`

Fetches a note's structure, including headings, links, and backlinks. Use this to quickly understand the organization of
a note and navigate to related content without reading the full text.

### `list_directory`

Lists files and folders at a specific path in the vault. Returns a markdown list with folder paths and file counts, and
file names. This helps the agent understand the vault's organization and discover notes by browsing the hierarchy.

