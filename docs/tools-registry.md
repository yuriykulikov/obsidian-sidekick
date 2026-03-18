# Tools Registry

A management system for tools available to the agent. All tools in the registry are described to the agent during each
iteration of the loop, ensuring it always knows its current capabilities.

Tool entry provides clear definitions and descriptions for the LLM to understand tool capabilities.
Examples include:

- [tool-context-discovery.md](tool-context-discovery.md) to find the context of a note.
- Search by text
- Search by tags

## Tool definition

Each tool must be defined with:

- **Name**: Unique identifier for the LLM to call.
- **Description**: Clear explanation of what the tool does and when to use it.
- **Parameters**: JSON schema defining the required and optional inputs.
- **Returns**: Description of the data the tool provides back to the agent.

### Example: `read_note`

The following definition is used to inform the agent about the `read_note` tool:

- **Name**: `read_note`
- **Description**: Fetches a note and its surroundings (links and backlinks) with a specified level of detail.
- **Parameters**:
	- `noteTitle` (string, required): The title or path of the note.
	- `detail` (string, optional, default: `text`): The level of detail (`links-only`, `structure`, `compression`,
	  `text`).
- **Returns**: A structured representation of the note(s) found, including content (based on `detail`) and their
  relationships.

#### JSON Input Example:

```json
{
	"noteTitle": "Project Sidekick",
	"detail": "structure"
}
```

#### JSON Tool Call Example:

The agent invokes the tool by providing a structured JSON response:

```json
{
	"toolName": "read_note",
	"toolInput": {
		"noteTitle": "Project Sidekick",
		"detail": "structure"
	}
}
```
