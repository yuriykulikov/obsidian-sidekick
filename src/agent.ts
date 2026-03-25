import {
  type Chat,
  type CreateChatParameters,
  type FunctionResponse,
  type GenerateContentResponse,
  GoogleGenAI,
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
  refreshNotes,
  renderDiscoveredStructure,
  renderNoteToMarkdown,
} from "./utils/notes";

export class SidekickAgent {
  private genAI: GoogleGenAI;
  private chatSession: Chat | null = null;
  app: App;
  state: AgentState;
  logger: Logger;
  tools: Tool[];
  private onStateChange: (state: AgentState) => void;
  private stopRequested: boolean = false;

  /**
   * Returns the default system prompt for the agent.
   * @returns The system prompt string.
   */
  static getSystemPrompt(): string {
    const prompt = `You are a helpful assistant for Obsidian. 
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

    return prompt;
  }

  /**
   * Initializes a new instance of the SidekickAgent.
   * @param app - The Obsidian App instance.
   * @param apiKey - The Google Gemini API key.
   * @param state - The initial agent state.
   * @param logger - The logger instance.
   * @param tools - The list of tools available to the agent.
   * @param onStateChange - Callback function to notify when the state changes.
   */
  constructor(
    app: App,
    apiKey: string,
    state: AgentState,
    logger: Logger,
    tools: Tool[] = [],
    onStateChange: (state: AgentState) => void,
  ) {
    this.app = app;
    this.genAI = new GoogleGenAI({ apiKey });
    this.state = state;
    this.logger = logger;
    this.tools = tools;
    this.onStateChange = onStateChange;
  }

  /**
   * Updates the internal state and notifies via onStateChange callback.
   * @param newState - The new state to apply.
   */
  public setState(newState: AgentState): void {
    this.state = newState;
    this.onStateChange(this.state);
  }

  /**
   * Processes the next user prompt by updating the state and running the agent loop.
   * @param userPrompt - The user's input message.
   * @returns A promise that resolves when the agent finishes processing.
   */
  async next(userPrompt: string): Promise<void> {
    this.setState(await refreshNotes(this.app, this.state));
    // Add current user message to state history
    this.setState(
      this.state.appendHistoryEntry({
        type: "text",
        role: "user",
        content: userPrompt,
      }),
    );
    this.logger.user(`User prompt: ${userPrompt}`);
    await this.agentLoop();
  }

  /**
   * Initializes the chat session if it doesn't already exist.
   */
  private createChatSession() {
    if (!this.chatSession) {
      if (this.state.history.length === 1) {
        this.logger.info(`Creating new chat session`);
      } else {
        this.logger.info(
          `Creating new chat session with ${this.state.history.length} history entries`,
        );
      }

      const systemInstruction = SidekickAgent.getSystemPrompt();
      this.logger.markdown(`System Prompt`, systemInstruction);

      const params: CreateChatParameters = {
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: systemInstruction,
          tools:
            this.tools.length > 0
              ? [
                  {
                    functionDeclarations: this.tools.map((t) =>
                      t.getDeclaration(),
                    ),
                  },
                ]
              : undefined,
        },
        history: this.state.history
          .filter((m): m is TextHistoryEntry => m.type === "text")
          .map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
      };
      this.chatSession = this.genAI.chats.create(params);
    }
  }

  private async agentLoop(): Promise<void> {
    this.createChatSession();
    this.stopRequested = false;
    let iterations = 0;
    const maxIterations = 15;

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
      this.state.appendHistoryEntry({
        type: "text",
        role: "model",
        content: finalContent + postfix,
      }),
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

    const response = await this.chatSession?.sendMessage({
      message: message,
    });

    if (!response) {
      throw new Error("Chat session not initialized or failed to get response");
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
          type: "function_call",
          role: "model",
          call: {
            name: call.name,
            args: call.args as Record<string, unknown>,
          },
          result: result,
          pretty: result.pretty,
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
