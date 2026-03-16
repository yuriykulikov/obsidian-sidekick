# Context on Demand (Discovery)

This tool allows the agent to discover context on demand by fetching notes related to a specific note or by title.

## Tool definition

### `get_notes`

Fetches a note and its surroundings (links and backlinks) with a specified level of detail and depth.

**Parameters:**

- `noteTitle` (string, required): The title or path of the note to fetch context for.
- `detail` (string, optional, default: `text`): The level of detail to return for the requested note and its immediate
  neighbors.
	- `links-only`: Only returns the title and a list of outgoing links and backlinks. Useful for graph exploration.
	- `structure`: Returns the title, metadata (frontmatter, tags), headers, and links/backlinks.
	- `compression`: Returns a summarized version of the note content along with links/backlinks. (TBD: implementation)
	- `text`: Returns the full markdown content of the note along with links/backlinks.

**Returns:**
A structured representation of the note(s) found, including content (based on `detail`) and their relationships.

