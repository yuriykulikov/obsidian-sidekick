import {
  type Chat,
  type CreateChatParameters,
  GoogleGenAI,
} from "@google/genai";
import type { App } from "obsidian";
import { SidekickAgent } from "./agent";
import { GrepSearchTool } from "./tools/grep-search";
import { ListDirectoryTool } from "./tools/list-directory";
import { ReadNoteTool } from "./tools/read-note";
import { ReadNoteLinksTool } from "./tools/read-note-links";
import { ReadNoteStructureTool } from "./tools/read-note-structure";
import { SearchNotesTool } from "./tools/search-notes";
import { AgentState, type TextHistoryEntry, type Tool } from "./types";
import type { Logger } from "./utils/logger";

/**
 * The `AgentFactory` is responsible for the construction of `SidekickAgent` instances
 * and their runtime environment.
 *
 * It acts as the central hub for dependency injection, instantiating the
 * **Tool Catalog** and preparing the necessary `ChatSession` and system prompts.
 * This pattern decouples the core agent logic from the Obsidian UI.
 */
export class AgentFactory {
  constructor(
    private readonly app: App,
    private readonly logger: Logger,
    private readonly apiKeyProvider: () => string | undefined,
  ) {}

  /**
   * Creates a new chat session using the Gemini API.
   * @param state - The current agent state.
   * @param tools - The list of tools available to the agent.
   * @param systemInstruction - The system instruction string.
   * @returns A new Chat session instance.
   */
  public createChatSession(
    state: AgentState,
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
      history: state.history
        .filter((m): m is TextHistoryEntry => m.type === "text")
        .map((m) => ({
          role: m.role,
          parts: [{ text: m.content }],
        })),
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

**Guidelines for using tools:**
1. **Explore context first:** Before requesting more notes, carefully analyze the current context provided to you. Use the tools ONLY when you truly need more information to answer the user's request.
2. **Explain your reasoning:** If you decide to use a tool, briefly state why it is necessary (e.g., "I need to check the 'Project Goals' note to see the specific requirements").
3. **Be judicious:** Avoid requesting the same note multiple times.
4. **Tool-based operation:** You must ONLY use the tools provided to you. If a task cannot be completed with the available tools, inform the user about the limitation.
5. **Format:** Always respond in markdown format. When answering, focus on the user's request.

**Strategy for multi-step tasks:**
- If the user's prompt is broad, start by fetching the most relevant notes or exploring the file system.
- Use links and backlinks information from the notes to discover other relevant notes.
- If you have enough information, synthesize a final answer instead of making more tool calls.
`;
  }

  /**
   * Creates a new instance of the SidekickAgent with all required tools and configuration.
   * @param onStateChange - Callback function to notify when the state changes.
   * @returns A new SidekickAgent instance.
   */
  public createAgentInstance(
    onStateChange: (state: AgentState) => void,
  ): SidekickAgent {
    const state: AgentState = new AgentState();
    const tools = [
      new ReadNoteTool(this.app, this.logger),
      new ReadNoteLinksTool(this.app, this.logger),
      new ReadNoteStructureTool(this.app, this.logger),
      new SearchNotesTool(this.app, this.logger),
      new ListDirectoryTool(this.app, this.logger),
      new GrepSearchTool(this.app, this.logger),
    ];

    const systemPrompt = this.getSystemPrompt();

    let chatSession: Chat | undefined;
    let initError: string | undefined;

    try {
      chatSession = this.createChatSession(state, tools, systemPrompt);
      if (!chatSession) {
        initError =
          "API key is not configured. Please set your Gemini API key in the plugin settings.";
      }
    } catch (error) {
      initError = `Failed to initialize Gemini session: ${error instanceof Error ? error.message : String(error)}`;
    }

    return new SidekickAgent(
      this.app,
      chatSession,
      state,
      this.logger,
      systemPrompt,
      tools,
      onStateChange,
      initError,
    );
  }
}
