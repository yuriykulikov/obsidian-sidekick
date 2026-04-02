# Spec: Editing Notes (staged suggestions)

Agents can propose edits to notes via the `edit-note` tool. Under the hood these edits are represented as **suggestions
**
that are staged in the agent state during the loop.

Important constraints (matching the current implementation):

- The tool can **only edit notes already present in the conversation context** (i.e. notes that exist in
  `AgentState.notes`).
- Edits are applied in-memory immediately when the tool succeeds.
- Notes that were edited are marked with `Note.hasSuggestions = true`.
- At the **end of the agent loop iteration**, the agent persists all notes with `hasSuggestions` to disk.

## Tool: `edit-note`

Agents specify which note to edit and which exact text to replace.

The agent receives feedback if applying the suggestions succeeds or fails (e.g. note not found in current context, or
the text to replace was not found).

### Parameters

When calling this tool, the LLM must provide a list of **suggestion objects** under the `suggestions` argument. Each
suggestion object contains:

- `note`: Identifies the target note.
- `textToReplace`: The exact text in the note to be replaced.
- `replacement`: The suggested new text.

`note` can be either:

- a note title/basename (e.g. `Meeting Notes`)
- a vault path (including `.md`) (e.g. `Productivity/Meeting Notes.md`)

### Multiple suggestions

The LLM can return multiple suggestions by invoking the tool multiple times or by invoking the tool once with multiple
suggestions.

### Examples

**Example 1: Two separate tool calls in a single turn**

In this scenario, the LLM decides to issue two separate calls to `edit-note`, each containing one suggestion.

```json
[
	{
		"name": "edit-note",
		"arguments": {
			"suggestions": [
				{
					"note": "Meeting Notes.md",
					"textToReplace": "The project is on track.",
					"replacement": "The project is ahead of schedule."
				}
			]
		}
	},
	{
		"name": "edit-note",
		"arguments": {
			"suggestions": [
				{
					"note": "Meeting Notes.md",
					"textToReplace": "Budget: $10k",
					"replacement": "Budget: $12k"
				}
			]
		}
	}
]
```

**Example 2: A single tool call with two suggestions**

In this scenario, the LLM provides all two suggestions within a single call to `edit-note`.

```json
[
	{
		"name": "edit-note",
		"arguments": {
			"suggestions": [
				{
					"note": "Meeting Notes.md",
					"textToReplace": "The project is on track.",
					"replacement": "The project is ahead of schedule."
				},
				{
					"note": "Meeting Notes.md",
					"textToReplace": "Budget: $10k",
					"replacement": "Budget: $12k"
				}
			]
		}
	}
]
```

### Return Value

When the tool is called, it returns a **status indicator** to the agent:

- `success`: All suggestions were applied to the in-memory `AgentState` (and notes were marked with `hasSuggestions`).
- `error`: At least one suggestion could not be applied (e.g. note not found in current context, or text not found).
  Details are included under an `## Errors` section in the tool output.

Implementation detail: if any error occurs, the tool returns the **previous state** (i.e. the call is treated as failed
as a whole), even though edits may have been attempted while processing suggestions.

## Tool use: instructions for the LLM

#### Overlapping edits

If the agent intends to make multiple overlapping changes at the same time, there are several ways of doing that:

- Provide a merged suggestion instead of multiple overlapping ones
- Make sure `textToReplace` takes into account that previous replacement was applied

Also note: the current implementation uses JavaScript string replacement and will replace the **first occurrence** of
`textToReplace`.

## State Representation

When the tool is called, changes are applied to notes in the `AgentState` class and `Note.hasSuggestions` property is
set to `true`. Changes are applied to the `AgentState` (by copying the immutable state with modification), but are kept
in memory and are not written to the vault until the agent finishes the loop iteration.

## View

### Chat View

#### Notes view

Modified notes are highlighted with accent color.
