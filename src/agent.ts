import type {
  Chat,
  FunctionResponse,
  GenerateContentResponse,
} from "@google/genai";
import type { App } from "obsidian";
import type {
  AgentState,
  TextHistoryEntry,
  Tool,
  ToolCallHistoryEntry,
  ToolResult,
} from "./types";
import type { Logger } from "./utils/logger";
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
  ) {
    this.app = app;
    this.chatSession = chatSession;
    this.state = state;
    this.logger = logger;
    this.systemInstruction = systemInstruction;
    this.tools = tools;
    this.onStateChange = onStateChange;
    this.initError = initError;
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
   * Updates the thinking status of the agent.
   * @param isThinking - The new thinking status.
   */
  public setThinking(isThinking: boolean): void {
    this.setState(this.state.setThinking(isThinking));
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
    let iterations = 0;
    const maxIterations = 15;
    this.setState(this.state.setThinking(true));
    while (true) {
      iterations++;

      let iterationResponse = await this.promptLLM();

      const functionCalls = iterationResponse.functionCalls;

      if (
        this.stopRequested ||
        iterations >= maxIterations ||
        !functionCalls ||
        functionCalls.length === 0
      ) {
        await this.finalizeLoop(
          iterationResponse.text ?? "",
          iterations,
          maxIterations,
        );
        return;
      }

      iterationResponse = await this.handleFunctionCalls(iterationResponse);
    }
  }

  private async finalizeLoop(
    finalContent: string,
    iterations: number,
    maxIterations: number,
  ): Promise<void> {
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

  /**
   * Sends a message to the LLM with the current note context and history.
   * @returns A promise that resolves to the LLM response.
   */
  private async promptLLM(): Promise<GenerateContentResponse> {
    // Find the last user prompt in history
    const userEntries = this.state.history.filter(
      (h): h is TextHistoryEntry => h.type === "text" && h.role === "user",
    );
    const lastUserEntry = userEntries[userEntries.length - 1];
    const prompt = lastUserEntry ? lastUserEntry.content : "";
    this.logger.info(`Sending message...`);
    // Prepare context for the prompt from notes
    const structureStr =
      this.state.discoveredStructure.length > 0
        ? (() => {
            const rendered = renderDiscoveredStructure(
              this.state.discoveredStructure,
            );
            this.logger.markdown(
              "Discovered Vault Structure",
              `\`\`\`\n${rendered}\n\`\`\``,
            );
            return `# Discovered Vault Structure\n\n\`\`\`\n${rendered}\n\`\`\`\n\n`;
          })()
        : "";

    const contextStr =
      this.state.notes.size > 0
        ? `# Notes\n\n${Array.from(this.state.notes.values())
            .map((note) => {
              const md = renderNoteToMarkdown(note);
              this.logger.markdown(
                `${note.content ? "Note content " : "Note structure "} ${note.filename}`,
                md,
              );
              return md;
            })
            .join("\n")}\n\n`
        : "";

    // Prepare history for the prompt to make it clear we are in a loop
    const loopHistory = this.state.history.filter(
      (h): h is ToolCallHistoryEntry => h.type === "function_call",
    );
    const historyStr =
      loopHistory.length > 0
        ? `# Tool execution history in this loop\n${loopHistory
            .map((h) => {
              const callArgs = JSON.stringify(h.call.args);
              const resultText =
                "output" in h.result
                  ? typeof h.result.output === "string"
                    ? h.result.output
                    : JSON.stringify(h.result.output)
                  : h.result.error;
              this.logger.markdown(
                `Tool Call ${h.call.name}(${callArgs})`,
                resultText,
              );
              return `## Tool Call: \`${h.call.name}(${callArgs})\n${resultText}`;
            })
            .join("\n")}\n`
        : "";

    this.logger.info(`Prompt: ${prompt}`);

    const message = `${structureStr}${contextStr}${historyStr}\n# User Question\n${prompt}`;

    this.logger.markdown(`Full prompt`, message);

    if (!this.chatSession) {
      throw new Error(this.initError || "Chat session not initialized");
    }

    const response = await this.chatSession.sendMessage({
      message: message,
    });

    if (!response) {
      throw new Error("Failed to get response from Gemini");
    }

    this.logResponse(response, "to prompt the LLM");
    return response;
  }

  /**
   * Handles function calls from the model by executing tools and returning results.
   * @param iterationResponse - The model response containing function calls and potentially text.
   * @returns A promise that resolves to the tool results.
   */
  private async handleFunctionCalls(
    iterationResponse: GenerateContentResponse,
  ): Promise<GenerateContentResponse> {
    const functionCalls = iterationResponse.functionCalls;
    if (!functionCalls || functionCalls.length === 0) {
      return iterationResponse;
    }
    if (iterationResponse.text) {
      this.logger.info(`LLM Response: ${iterationResponse.text}`);
      this.setState(
        this.state.appendHistoryEntry({
          type: "text",
          role: "model",
          content: iterationResponse.text,
        }),
      );
    }

    const results: FunctionResponse[] = [];
    for (const call of functionCalls) {
      if (!call.name) continue;
      const result = await this.executeTool(
        call.name,
        (call.args as Record<string, unknown>) ?? {},
      );

      results.push({
        name: call.name,
        id: call.id,
        response: result,
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
          pretty: result.pretty,
          collapsed: true,
        }),
      );
    }

    const response = await this.chatSession?.sendMessage({
      message: [
        ...results.map((r) => {
          const responseBody: Record<string, unknown> = {
            ...(r.response as Record<string, unknown>),
          };
          return {
            functionResponse: {
              name: r.name,
              id: r.id,
              response: responseBody,
            } as FunctionResponse,
          };
        }),
      ],
    });

    if (!response) {
      throw new Error("Chat session not initialized or failed to get response");
    }

    this.logResponse(response, "to send function responses");
    if (response.text) {
      this.logger.info(
        `Final model response after function calls: ${response.text}`,
      );
    }

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
      const duration = Date.now() - startTime;
      this.setState(newState);
      result = res;
      let logText: string;
      if (result.pretty) {
        logText = `${result.pretty} (${duration}ms)`;
      } else if ("output" in res) {
        logText =
          typeof res.output === "string"
            ? `${res.output} (${duration}ms)`
            : JSON.stringify(res.output);
      } else {
        logText = `${res.error} (${duration}ms)`;
      }
      this.logger.markdown(
        `Called tool ${name}(${JSON.stringify(args)})`,
        logText,
      );
    } else {
      this.logger.warn(`Tool ${name} not found.`);
      result = { error: `Tool ${name} not found.` };
    }
    return result;
  }

  /**
   * Signals the agent to stop its current loop.
   */
  stop() {
    this.stopRequested = true;
  }

  dispose() {
    stop();
    this.disposed = true;
  }

  /**
   * Logs detailed information about the LLM response.
   * @param response - The GenerateContentResponse from the model.
   * @param forWhat - Optional description of what the response was for.
   */
  private logResponse(
    response: GenerateContentResponse,
    forWhat?: string,
  ): void {
    const tokens = response.usageMetadata?.totalTokenCount ?? "unknown";
    const logMsg = forWhat
      ? `Sent ${forWhat}, used ${tokens} tokens`
      : `Used ${tokens} LLM tokens`;
    this.logger.info(logMsg);
    if (response.promptFeedback) {
      this.logger.info(
        `Prompt feedback: ${JSON.stringify(response.promptFeedback)}`,
      );
    }
    if (response.functionCalls && response.functionCalls.length > 0) {
      const formattedCalls = response.functionCalls
        .map((call) => `${call.name}(${JSON.stringify(call.args)})`)
        .join(", ");
      this.logger.info(`LLM requested: [${formattedCalls}]`);
    }
    if (response.data) {
      this.logger.info(`Response data: ${response.data}`);
    }
  }
}
