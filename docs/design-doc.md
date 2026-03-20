# Sidekick: Design Document

This document outlines the design and architecture of Sidekick, an AI agent for Obsidian.

## UI: Agent Appearance and Interaction

The agent should follow the interaction patterns of a modern coding agent (e.g., Junie).

- **Conversational & Transparent**: The agent explains its reasoning and actions.
- **Context on Demand**: Users can pull in specific notes or the agent can request them.
- **Obsidian Native Tools**: Integrated with Obsidian search, metadata, and APIs.
- **Interactive**: The agent asks clarifying questions and makes actionable suggestions.

## Agent Context and Loop

- **Arch: Separation of the Agent Loop from UI**: The core logic of the agent resides in a standalone loop that
  communicates with the Obsidian view via a well-defined interface. This ensures the agent can be tested and developed
  independently of the UI.
- **Tools**:
	- **Context Discovery**: A tool that allows the agent to identify and pull in relevant notes based on the current
	  conversation or explicit user request.
	- **Output**: A tool that handles how the agent presents information back to the user, including Markdown rendering
	  and Obsidian-specific components.
	- **Tasks Plugin - Skills and Tools**: Specialized tools and logic to interact with
	  the [Obsidian Tasks](https://github.com/obsidian-tasks-group/obsidian-tasks) plugin, allowing the agent to read,
	  create, and update tasks.

## Concepts & Architecture

In a nutshell, the agent is a program that receives user input and a tool catalog and iterates
to achieve a goal, using the tools to achieve the goal. Agent provides intermediate indications to the user as well as
a final answer, which might be a message or a suggestion to change a note.

### Separation of Agent Loop from UI

The agent loop is separated from the UI. UI integration is done through explicitly defined APIs (similar to tools).

### Agent context and loop

For now the agent uses a simple transducer loop:

The agent operates in a simple, flat loop. In each iteration, the current context is explicitly
passed to the LLM, which then decides the next action—whether to use a tool to gather more
information or provide a final answer to the user.

Agent architecture is described in detail in further documents.

- [agent-context-and-loop.md](agent-context-and-loop.md)
- [tools-registry.md](tools-registry.md)
- [context-discovery.md](context-discovery.md)
- [12-factor-agents.md](12-factor-agents.md)

## Testing Strategy

Focus on integration with Obsidian in the loop:

- **Tool Tests**: Verify tool functionality without calling the LLM
- **E2E Tests**: Full-loop testing with the LLM to verify agent behavior and goal achievement (with test vault)

## Design Decisions

### 1. Forego Vector Database

Obsidian vaults are naturally structured through links and folders. Navigating these relationships (graph-based search)
with links, using free-text search, tag search, directory structure is prioritized over semantic search with embeddings
to reduce complexity, stay "Obsidian native" and increase relevance.

### 2. Direct API Usage (No MCP)

Sidekick interacts directly with the Obsidian API. This reduces friction and allows for deeper integration with
Obsidian-specific features without the overhead of an intermediate protocol like MCP.

### 3. Configurable Personality

Allow users to define the "tone" and "behavior" of their Sidekick via settings.

## Ideas and future possibilities

### Tasks Plugin Integration

Provide the agent with specialized knowledge of the Tasks plugin:

- Query tasks on the fly across the vault.
- Write and embed task queries into notes.
