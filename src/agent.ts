import type {
  Chat,
  FunctionResponse,
  GenerateContentResponse,
} from "@google/genai";
import type { App } from "obsidian";
import type { AgentFactory } from "./agent-factory";
import type { AgentState, TextHistoryEntry, Tool } from "./types";
import { ToolResult } from "./types";
import type { Logger } from "./utils/logger";
import { LogLevel } from "./utils/logger";
import {
  addNote,
  refreshNotes,
  renderDiscoveredStructure,
  renderNoteToMarkdown,
  setActiveNote,
} from "./utils/notes";

/**
 * `SidekickAgent` is the core engine of the AI assistant, implementing a
 * "transducer loop" that interacts with the Gemini LLM.
 *
 * It follows a **Dependency Injection** pattern, receiving all its capabilities
 * (Obsidian App, chat session, logger, and its **Tool Catalog**) via its constructor.
 * This ensures the agent logic is decoupled from its instantiation and the plugin UI.
 */
export class SidekickAgent {
  private chatSession: Chat | undefined;
  app: App;
  state: AgentState;
  logger: Logger;
  systemInstruction: string;
  tools: Tool[];
  private agentFactory: AgentFactory | undefined;
  private onStateChange: (state: AgentState) => void;
  private stopRequested: boolean = false;
  private disposed: boolean = false;
  private initError: string | undefined;

  /**
   * Initializes a new instance of the SidekickAgent.
   * @param app - The Obsidian App instance.
   * @param chatSession - The Gemini Chat session instance (optional).
   * @param state - The initial agent state.
   * @param logger - The logger instance.
   * @param systemInstruction - The system instruction string.
   * @param tools - The list of tools available to the agent.
   * @param onStateChange - Callback function to notify when the state changes.
   * @param initError - Error message if initialization failed.
   * @param agentFactory - The factory used to recreate a fresh chat session per prompt.
   */
  constructor(
    app: App,
    chatSession: Chat | undefined,
    state: AgentState,
    logger: Logger,
    systemInstruction: string,
    tools: Tool[] = [],
    onStateChange: (state: AgentState) => void,
    initError?: string,
    agentFactory?: AgentFactory,
  ) {
    this.app = app;
    this.chatSession = chatSession;
    this.state = state;
    this.logger = logger;
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.onStateChange = onStateChange;
    this.initError = initError;
    this.agentFactory = agentFactory;
  }

  /**
   * Updates the internal state and notifies via onStateChange callback.
   * @param newState - The new state to apply.
   */
  public setState(newState: AgentState): void {
    this.state = newState;
    if (!this.disposed) {
      this.onStateChange(this.state);
    }
  }

  public setStateDeferNotify(newState: AgentState): void {
    this.state = newState;
  }

  /**
   * Adds a note to the agent's context.
   * @param filename - The name of the note to add.
   */
  public async addNote(filename: string): Promise<void> {
    const newState = await addNote(this.app, this.state, filename);
    this.setState(newState);
  }

  /**
   * Sets the active note in the agent's context.
   * @param filename - The name of the note to set as active.
   */
  public async setActiveNote(filename: string): Promise<void> {
    const newState = await setActiveNote(this.app, this.state, filename);
    this.setState(newState);
  }

  /**
   * Removes a note from the agent's context.
   * @param filename - The name of the note to remove.
   */
  public removeNote(filename: string): void {
    this.setState(this.state.removeNote(filename));
  }

  /**
   * Collapses or expands a history entry.
   * @param id - The ID of the history entry.
   * @param collapsed - The new collapsed state.
   */
  public setHistoryEntryCollapsed(id: string, collapsed: boolean): void {
    this.setStateDeferNotify(
      this.state.setHistoryEntryCollapsed(id, collapsed),
    );
  }

  /**
   * Processes the next user prompt by updating the state and running the agent loop.
   * @param userPrompt - The user's input message.
   * @returns A promise that resolves when the agent finishes processing.
   */
  async next(userPrompt: string): Promise<void> {
    if (this.initError) {
      this.setState(
        this.state.appendHistoryEntry({
          type: "text",
          role: "model",
          content: this.initError,
        }),
      );
      return;
    }

    // Create a fresh chat session for each user prompt so the Gemini API
    // context window never grows across turns. All history and note context
    // are included explicitly in the prompt message body.
    if (this.agentFactory) {
      try {
        const newSession = this.agentFactory.createChatSession(
          this.tools,
          this.systemInstruction,
        );
        if (newSession) {
          this.chatSession = newSession;
        }
      } catch (error) {
        this.logger.error(
          `Failed to recreate chat session: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.user(`User prompt: ${userPrompt}`);
    this.setState(
      (await refreshNotes(this.app, this.state))
        // Add current user message to state history
        .appendHistoryEntry({
          type: "text",
          role: "user",
          content: userPrompt,
        }),
    );

    try {
      await this.agentLoop();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(`Agent error: ${errorMessage}`);
      this.setState(
        this.state
          .appendHistoryEntry({
            type: "text",
            role: "model",
            content: `Error: ${errorMessage}`,
          })
          .setThinking(false),
      );
    }
  }

  private async agentLoop(): Promise<void> {
    this.stopRequested = false;
    let iterations: number;
    const maxIterations = 15;
    this.setState(this.state.setThinking(true));

    // Call promptLLM once before entering the loop
    let iterationResponse = await this.promptLLM();
    const initialPromptTokens = this.getTokenCount(iterationResponse);
    let toolTokensTotal = 0;
    iterations = 1;

    while (true) {
      const earlyExit = this.stopRequested || iterations >= maxIterations;
      const functionCalls = iterationResponse.functionCalls;
      if (earlyExit || !functionCalls || functionCalls.length === 0) {
        await this.finalizeLoop(
          iterationResponse.text ?? "",
          iterations,
          maxIterations,
          initialPromptTokens,
          toolTokensTotal,
        );
        return;
      } else {
        if (iterationResponse.text) {
          this.logger.loop(`LLM Response: ${iterationResponse.text}`);
          this.setState(
            this.state.appendHistoryEntry({
              type: "text",
              role: "model",
              content: iterationResponse.text,
            }),
          );
        }
        iterationResponse = await this.handleFunctionCalls(iterationResponse);
        const toolTokens = this.getTokenCount(iterationResponse);
        toolTokensTotal += toolTokens;
        iterations++;
      }
    }
  }

  private async finalizeLoop(
    finalContent: string,
    iterations: number,
    maxIterations: number,
    initialPromptTokens: number,
    toolTokensTotal: number,
  ): Promise<void> {
    this.logger.markdown(
      `Final LLM Response after ${iterations} iterations (initial prompt tokens: ${initialPromptTokens}, tool tokens total: ${toolTokensTotal})`,
      finalContent,
    );

    let postfix = "";
    if (this.stopRequested) {
      this.logger.warn("Agent loop stopped by user.");
      postfix = "\n\nAgent loop stopped by user.";
    } else if (iterations >= maxIterations) {
      this.logger.warn(
        `Max iterations (${maxIterations}) reached. Breaking loop.`,
      );
      postfix = `\n\nMax iterations (${maxIterations}) reached. Breaking loop.`;
    }

    this.setState(
      this.state
        .appendHistoryEntry({
          type: "text",
          role: "model",
          content: finalContent + postfix,
        })
        .setThinking(false),
    );
  }

  private getTokenCount(response: GenerateContentResponse): number {
    const tokens = response.usageMetadata?.totalTokenCount;
    return typeof tokens === "number" ? tokens : 0;
  }

  /**
   * Sends a message to the LLM with the current note context and history.
   * @returns A promise that resolves to the LLM response.
   */
  private async promptLLM(): Promise<GenerateContentResponse> {
    // Find the last user prompt in history (used as the current question at the end)
    const userEntries = this.state.history.filter(
      (h): h is TextHistoryEntry => h.type === "text" && h.role === "user",
    );
    const lastUserEntry = userEntries[userEntries.length - 1];
    const prompt = lastUserEntry ? lastUserEntry.content : "";
    // Prepare context for the prompt from notes
    const structureStr = this.renderDiscoveredNoteStructureSection();
    const contextStr = this.renderNotesSection();
    const activityLogStr = this.renderConversationAndActivityLog();

    const message = `${structureStr}${contextStr}${activityLogStr}\n# User Question\n${prompt}`;

    if (!this.chatSession) {
      throw new Error(this.initError || "Chat session not initialized");
    }

    const response = await this.chatSession.sendMessage({
      message: message,
    });

    if (!response) {
      throw new Error("Failed to get response from Gemini");
    }

    const tokens = response.usageMetadata?.totalTokenCount ?? "unknown";
    this.logger.markdown(
      `Full prompt (${tokens} tokens)`,
      message,
      LogLevel.CONTEXT,
    );
    if (response.promptFeedback) {
      this.logger.info(
        `Prompt feedback: ${JSON.stringify(response.promptFeedback)}`,
      );
    }
    return response;
  }

  private renderNotesSection() {
    return this.state.notes.size > 0
      ? `# Notes\n\n${Array.from(this.state.notes.values())
          .map((note) => {
            const md = renderNoteToMarkdown(note);
            this.logger.markdown(
              `${note.content ? "Note content " : "Note structure "} ${note.filename}`,
              md,
              LogLevel.CONTEXT,
            );
            return md;
          })
          .join("\n")}\n---\n`
      : "";
  }

  private renderDiscoveredNoteStructureSection() {
    return this.state.discoveredStructure.length > 0
      ? (() => {
          const rendered = renderDiscoveredStructure(
            this.state.discoveredStructure,
          );
          this.logger.markdown(
            "Discovered Vault Structure",
            `\`\`\`\n${rendered}\n\`\`\``,
            LogLevel.CONTEXT,
          );
          return `# Discovered Vault Structure\n\n\`\`\`\n${rendered}\n\`\`\`\n---\n`;
        })()
      : "";
  }

  /**
   * Render a unified, chronological log interleaving user/agent messages with
   * tool calls and tool results.
   *
   * This is intentionally "AI-first": it preserves the timeline that led to
   * each tool invocation, helping the model avoid mixing tool outputs across
   * unrelated sub-threads.
   *
   * The most recent text entry is excluded because the latest user prompt is
   * appended separately at the end under "User Question".
   */
  private renderConversationAndActivityLog(): string {
    const fullHistory = this.state.history;
    if (fullHistory.length === 0) return "";

    // Exclude last text entry (the latest prompt or latest agent message), to avoid duplication
    const lastTextIdx = (() => {
      for (let i = fullHistory.length - 1; i >= 0; i--) {
        if (fullHistory[i]?.type === "text") return i;
      }
      return -1;
    })();
    const history =
      lastTextIdx >= 0
        ? [
            ...fullHistory.slice(0, lastTextIdx),
            ...fullHistory.slice(lastTextIdx + 1),
          ]
        : fullHistory;

    const rendered = history
      .map((h) => {
        if (h.type === "text") {
          const roleLabel =
            h.role === "user" ? "User prompt" : "Agent response";
          return `## ${roleLabel}\n${h.content}`;
        } else {
          const callArgs = JSON.stringify(h.call.args);
          const toolCall = `## Tool Call\n\`${h.call.name}(${callArgs})\``;
          const resultText = h.result.historyEntry();
          const toolResult = `### Tool Result\n${resultText}`;
          return `${toolCall}\n${toolResult}`;
        }
      })
      .join("\n");

    const logStr = `# Conversation & Activity Log\n${rendered}\n---\n`;
    this.logger.markdown(
      "Conversation & activity log",
      logStr,
      LogLevel.CONTEXT,
    );
    return logStr;
  }

  /**
   * Handles function calls from the model by executing tools and returning results.
   * @param iterationResponse - The model response containing function calls and potentially text.
   * @returns A promise that resolves to the tool results.
   */
  private async handleFunctionCalls(
    iterationResponse: GenerateContentResponse,
  ): Promise<GenerateContentResponse> {
    const functionCalls = iterationResponse.functionCalls ?? [];

    const results: {
      name: string;
      id: string | undefined;
      result: ToolResult;
    }[] = [];
    for (const call of functionCalls) {
      if (!call.name) continue;
      const result = await this.executeTool(
        call.name,
        (call.args as Record<string, unknown>) ?? {},
      );

      results.push({
        name: call.name,
        id: call.id,
        result,
      });

      // Add this function call and its result to history immediately
      this.setState(
        this.state.appendHistoryEntry({
          id: call.id || Math.random().toString(36).substring(2, 9),
          type: "function_call",
          role: "model",
          call: {
            name: call.name,
            args: call.args as Record<string, unknown>,
          },
          result: result,
          collapsed: true,
        }),
      );
    }

    const response: GenerateContentResponse | undefined =
      await this.chatSession?.sendMessage({
        message: [
          ...results.map((r) => {
            return {
              functionResponse: {
                name: r.name,
                id: r.id,
                response: r.result.llmOutput() as Record<string, unknown>,
              } as FunctionResponse,
            };
          }),
        ],
      });

    if (!response) {
      this.logger.error(
        "Chat session not initialized or failed to get response",
      );
      throw new Error("Chat session not initialized or failed to get response");
    }

    const tokens = response.usageMetadata?.totalTokenCount ?? "unknown";
    const logMsg = `Used ${tokens} tokens to send function responses`;
    this.logger.tool(logMsg);

    return response;
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolResult> {
    const tool = this.tools.find((t) => t.getDeclaration().name === name);
    let result: ToolResult;
    const startTime = Date.now();
    if (tool) {
      const [newState, res] = await tool.execute(this.state, args);
      result = res;

      this.setState(newState);
    } else {
      const message = `Tool ${name} not found.`;
      result = ToolResult.createError(message, message);
    }
    const duration = Date.now() - startTime;
    this.logger.markdown(
      `${result.summary} (${duration}ms)`,
      result.llmOutputString(),
      result.isError() ? LogLevel.ERROR : LogLevel.TOOL,
    );
    return result;
  }

  /**
   * Signals the agent to stop its current loop.
   */
  stop() {
    this.stopRequested = true;
  }

  dispose() {
    this.stop();
    this.disposed = true;
  }
}
