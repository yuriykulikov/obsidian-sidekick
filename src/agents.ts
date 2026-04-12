import {
  type Chat,
  type CreateChatParameters,
  GoogleGenAI,
} from "@google/genai";
import type { App } from "obsidian";
import { SidekickAgent } from "./agent";
import { AgentStateStore } from "./agent-state-store";
import { EditNoteTool } from "./tools/edit-note";
import { GrepSearchTool } from "./tools/grep-search";
import { ListDirectoryTool } from "./tools/list-directory";
import { ListTagsTool } from "./tools/list-tags";
import { ListUnlinkedNotesTool } from "./tools/list-unlinked-notes";
import { ReadNoteTool } from "./tools/read-note";
import { ReadNoteLinksTool } from "./tools/read-note-links";
import { ReadNoteStructureTool } from "./tools/read-note-structure";
import { SearchByTagTool } from "./tools/search-by-tag";
import { SearchNotesTool } from "./tools/search-notes";
import { AgentState, type Tool } from "./types";
import type { Logger } from "./utils/logger";

/**
 * The `AgentFactory` is responsible for the construction of `SidekickAgent` instances
 * and their runtime environment.
 *
 * It acts as the central hub for dependency injection, instantiating the
 * **Tool Catalog** and preparing the necessary `ChatSession` and system prompts.
 * This pattern decouples the core agent logic from the Obsidian UI.
 */
export class Agents {
  private readonly app: App;
  private readonly logger: Logger;
  private readonly apiKeyProvider: () => string | undefined;
  private readonly stateStore: AgentStateStore;
  current?: SidekickAgent = undefined;
  constructor(
    app: App,
    logger: Logger,
    apiKeyProvider: () => string | undefined,
  ) {
    this.app = app;
    this.logger = logger;
    this.apiKeyProvider = apiKeyProvider;
    this.stateStore = new AgentStateStore(this.app, this.logger);
  }

  /**
   * Creates a new chat session using the Gemini API.
   * @param tools - The list of tools available to the agent.
   * @param systemInstruction - The system instruction string.
   * @returns A new Chat session instance.
   */
  public createChatSession(
    tools: Tool[],
    systemInstruction: string,
  ): Chat | undefined {
    const apiKey = this.apiKeyProvider();
    if (!apiKey) {
      return undefined;
    }

    const genAI = new GoogleGenAI({ apiKey });

    const params: CreateChatParameters = {
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemInstruction,
        tools:
          tools.length > 0
            ? [
                {
                  functionDeclarations: tools.map((t) => t.getDeclaration()),
                },
              ]
            : undefined,
      },
    };

    return genAI.chats.create(params);
  }

  /**
   * Returns the default system prompt for the agent.
   * @returns The system prompt string.
   */
  private getSystemPrompt(): string {
    return `You are a helpful assistant for Obsidian. 
Answer the user's question or ask follow-up questions based on the provided context.

**Knowledge Organization:**
The vault is organized in a tree structure of folders and notes. Relevant notes are often located in the same folder or in nearby branches of the tree. Use the file system explorer to discover related information.

**Direct Navigation via Links:**
When you see a link like [[Note Name]] in the content, Links, or Backlinks sections, this is a direct reference. You MUST use 'read_note', 'read_note_structure' or 'read_note_links' with the exact name inside the brackets to access it. Do NOT use 'search_notes' or 'grep_search' for these names as you already have their direct identifiers.

**Guidelines for using tools:**
1. **Explore context first:** Before requesting more notes, carefully analyze the current context provided to you. Use the tools ONLY when you truly need more information to answer the user's request.
2. **Explain your reasoning:** If you decide to use a tool, briefly state why it is necessary (e.g., "I need to check the 'Project Goals' note to see the specific requirements").
3. **Prioritize direct links:** If a relevant note is mentioned as a link or backlink in the current context, use 'read_note', 'read_note_structure' or 'read_note_links' directly.
4. **Search and Discovery:** If you need to find something but don't have a direct link, use 'search_notes' (for titles), 'search_by_tag' (for tags), or 'grep_search' (for content).
5. **Be judicious:** Avoid requesting the same note multiple times.
6. **Tool-based operation:** You must ONLY use the tools provided to you. If a task cannot be completed with the available tools, inform the user about the limitation.
7. **Format:** Always respond in markdown format and use Obsidian links: [[link]].
8. When answering, focus on the user's request.

**Strategy for multi-step tasks:**
- If the user's prompt is broad, start by fetching the most relevant notes or exploring the file system.
- Use links and backlinks information from the notes to discover other relevant notes.
- If you have enough information, synthesize a final answer instead of making more tool calls.

**Feedback on tools:**
Your feedback is crucial for improving Sidekick.
- **Tool Use Feedback:** In your final response, if you found any tool particularly helpful or frustratingly limited, briefly mention it.
- **Suggestions for New Tools:** If you find yourself repeatedly wishing for a tool that doesn't exist (e.g., "I need to see images"), suggest it in your final response.
- **Tool Adjustments:** If an existing tool could be improved by adding or changing parameters, please let us know.
Include these reflections in a 'Feedback' section at the end of your final response to the user.
`;
  }

  /**
   * Restores the agent from persisted state and returns a fully constructed {@link SidekickAgent}.
   *
   * This method:
   * 1) Loads the last saved {@link AgentState} from {@link AgentStateStore}.
   * 2) Immediately notifies the UI via {@link onStateChange} with the restored state.
   * 3) Creates a new agent instance initialized with that restored state.
   *
   * @param onStateChange - Callback invoked when the state is loaded and whenever the agent later changes state.
   * @returns A {@link SidekickAgent} initialized with the restored state.
   */
  public async restoreAgentInstance(
    onStateChange: (state: AgentState) => void,
  ): Promise<SidekickAgent> {
    const restored = await this.stateStore.load();
    return this.createAgentInstanceWithState(restored, onStateChange);
  }

  /**
   * Creates a new instance of the SidekickAgent with all required tools and configuration.
   * @param onStateChange - Callback function to notify when the state changes.
   * @returns A new SidekickAgent instance.
   */
  public createAgentInstance(
    onStateChange: (state: AgentState) => void,
  ): SidekickAgent {
    const emptyState = new AgentState();
    this.stateStore.store(emptyState);
    return this.createAgentInstanceWithState(emptyState, onStateChange);
  }

  /**
   * Creates a new instance of the SidekickAgent with all required tools and configuration.
   * @param state - initial agent state
   * @param onStateChange - Callback function to notify when the state changes.
   * @returns A new SidekickAgent instance.
   */
  private createAgentInstanceWithState(
    state: AgentState,
    onStateChange: (state: AgentState) => void,
  ): SidekickAgent {
    const tools = [
      new ReadNoteTool(this.app, this.logger),
      new ReadNoteLinksTool(this.app, this.logger),
      new ReadNoteStructureTool(this.app, this.logger),
      new ListTagsTool(this.app, this.logger),
      new SearchByTagTool(this.app, this.logger),
      new SearchNotesTool(this.app, this.logger),
      new ListDirectoryTool(this.app, this.logger),
      new ListUnlinkedNotesTool(this.app, this.logger),
      new GrepSearchTool(this.app, this.logger),
      new EditNoteTool(this.app, this.logger),
    ];

    const systemPrompt = this.getSystemPrompt();

    let chatSession: Chat | undefined;
    let initError: string | undefined;

    try {
      chatSession = this.createChatSession(tools, systemPrompt);
      if (!chatSession) {
        initError =
          "API key is not configured. Please set your Gemini API key in the plugin settings.";
      }
    } catch (error) {
      initError = `Failed to initialize Gemini session: ${error instanceof Error ? error.message : String(error)}`;
    }

    const wrappedOnStateChange = (state: AgentState) => {
      onStateChange(state);
      this.stateStore.store(state);
    };

    const sidekickAgent = new SidekickAgent(
      this.app,
      chatSession,
      state,
      this.logger,
      systemPrompt,
      tools,
      wrappedOnStateChange,
      initError,
      this,
    );
    this.current = sidekickAgent;
    return sidekickAgent;
  }
}
