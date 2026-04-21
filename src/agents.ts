import {
  type Chat,
  type CreateChatParameters,
  GoogleGenAI,
} from "@google/genai";
import type { App } from "obsidian";
import { SidekickAgent } from "./agent";
import { AgentStateStore } from "./agent-state-store";
import { CreateNoteTool } from "./tools/create-note";
import { DeleteNoteTool } from "./tools/delete-note";
import { EditNoteTool } from "./tools/edit-note";
import { GrepSearchTool } from "./tools/grep-search";
import { ListDirectoryTool } from "./tools/list-directory";
import { ListTagsTool } from "./tools/list-tags";
import { ListUnlinkedNotesTool } from "./tools/list-unlinked-notes";
import { MoveRenameNoteTool } from "./tools/move-rename-note";
import { ReadNoteTool } from "./tools/read-note";
import { ReadNoteMetadataTool } from "./tools/read-note-metadata";
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
  private readonly maxIterationsProvider: () => number;
  private readonly stateStore: AgentStateStore;
  current?: SidekickAgent = undefined;
  constructor(
    app: App,
    logger: Logger,
    apiKeyProvider: () => string | undefined,
    maxIterationsProvider: () => number,
  ) {
    this.app = app;
    this.logger = logger;
    this.apiKeyProvider = apiKeyProvider;
    this.maxIterationsProvider = maxIterationsProvider;
    this.stateStore = new AgentStateStore(this.app, this.logger);
  }

  private getMaxIterations(): number {
    const raw = this.maxIterationsProvider();
    if (!Number.isFinite(raw)) return 30;
    return Math.max(5, Math.min(100, Math.trunc(raw)));
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
    const maxIterations = this.getMaxIterations();
    return `You are a helpful assistant for Obsidian.
Answer the user's question. If the request is ambiguous or you're unsure what the user wants, ask clarifying questions before taking action.
Always respond in markdown format and use Obsidian wikilinks: [[link]].

**Runtime limit:** You have a hard limit of **${maxIterations}** iterations. If you are approaching the limit, prioritize producing a best-effort final answer.

**Navigation & Discovery:**
Be mindful of token usage: only call tools when you have a clear reason.
- **Direct links (preferred):** When you see a [[Link]] in content, Links, or Backlinks sections, use 'read_note', 'read_note_structure', or 'read_note_metadata' with the exact name. Do NOT use 'search_notes' or 'grep_search' for names you already have. Always prefer following direct links over other discovery methods.
- **Search:** If you don't have a direct link, use 'search_notes' (titles), 'search_by_tag' (tags), or 'grep_search' (content).
- **Directory listing:** Only use when the user explicitly asks about folder contents or structure, not as a general exploration strategy.

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
      new ReadNoteMetadataTool(this.app, this.logger),
      new ReadNoteStructureTool(this.app, this.logger),
      new ListTagsTool(this.app, this.logger),
      new SearchByTagTool(this.app, this.logger),
      new SearchNotesTool(this.app, this.logger),
      new ListDirectoryTool(this.app, this.logger),
      new ListUnlinkedNotesTool(this.app, this.logger),
      new GrepSearchTool(this.app, this.logger),
      new EditNoteTool(this.app, this.logger),
      new CreateNoteTool(this.app, this.logger),
      new DeleteNoteTool(this.app, this.logger),
      new MoveRenameNoteTool(this.app, this.logger),
    ];

    const systemPrompt = this.getSystemPrompt();
    const maxIterations = this.getMaxIterations();

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
      maxIterations,
      tools,
      wrappedOnStateChange,
      initError,
      this,
    );
    this.current = sidekickAgent;
    return sidekickAgent;
  }
}
