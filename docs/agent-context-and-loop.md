## Agent Loop

```
generateSequence(Context(prompt, previosContext)) { context ->
  val response = LLM(toSystemPrompt(context))  
  when (response) {
    is LLMResponse.UseTool -> {
      val toolDescription = describe(response.toolName, response.description)
      val toolResult = useTool(response.toolName, response.toolInput)
      context + ToolUse(response.toolName, response.toolInput, toolDescription, toolResult)
    }
    is LLMResponse.ProvideAnswer -> {
      context + Answer(response.answer)
    }
  }
}
```

This simplistic loop basically asks the LLM each time for what to do next. It follows
the [12-Factor Agents](12-factor-agents.md) principles.

## Context Management

The agent's working context includes:

- **Prompt**: The user's original request or instructions.
- **Chat history**: Previous prompts and responses in the current session.
- **Selection**: Any manual text selections made by the user in the active note.
- **Current note**: The note the user is currently focused on.
- **Notes added by user**: Notes explicitly selected or added to the context by the user.
- **Notes added by the agent**: Notes discovered or pulled in by the agent via tools (e.g., `get_note_context`).

### Note Detail Levels

To manage tokens and provide relevant context, each note can be represented in the context at several levels of detail:

- **Links-only**: Only returns the note title and its links and backlinks. Useful for exploring the graph structure
  without the full text.
- **Structure**: Includes note title, metadata (tags, properties), headers (outline), and links/backlinks.
- **Compression**: A summarized or compressed version of the note content.
- **Full text**: The complete markdown content of the note.

When a note is requested with a higher detail level than already in the context, it should be replaced/updated.

## Tools Registry

The agent's capabilities are managed through a centralized registry. For a detailed description of how tools are defined
and registered, see [tools-registry.md](tools-registry.md).

## Future plans

### Token Optimization

To avoid "token bloat" and circular loops:

- **Prioritize Structure**: Use outlines and metadata before reading full text.
- **Compression & Caching**: Summarize or compress notes for reuse in the same session.
- **Ranking**: Evaluate and rank notes to determine if they should be included in subsequent prompts.
