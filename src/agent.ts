import { App } from "obsidian";
import { GoogleGenAI, Chat, GenerateContentResponse, CreateChatParameters, FunctionResponse } from "@google/genai";
import { AgentState, ToolResult, TextHistoryEntry, ToolCallHistoryEntry, Tool } from "./types";
import { Logger } from "./utils/logger";

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
        let prompt = `You are a helpful assistant for Obsidian. 
Answer the user's question or ask follow-up questions based on the provided context.

**Guidelines for using tools:**
1. **Explore context first:** Before requesting more notes, carefully analyze the current context provided to you. Use the tools ONLY when you truly need more information to answer the user's request.
2. **Explain your reasoning:** If you decide to use a tool, briefly state why it is necessary (e.g., "I need to check the 'Project Goals' note to see the specific requirements").
3. **Be judicious:** Avoid requesting the same note multiple times.
4. **Tool-based operation:** You must ONLY use the tools provided to you. If a task cannot be completed with the available tools, inform the user about the limitation.
5. **Format:** Always respond in markdown format. When answering, focus on the user's request.

**Strategy for multi-step tasks:**
- If the user's prompt is broad, start by fetching the most relevant notes.
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
    constructor(app: App, apiKey: string, state: AgentState, logger: Logger, tools: Tool[] = [], onStateChange: (state: AgentState) => void) {
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
        // Add current user message to state history
        this.setState({
            ...this.state,
            history: [...this.state.history, { type: "text", role: "user", content: userPrompt }]
        });

        await this.agentLoop();
    }

	/**
	 * Initializes the chat session if it doesn't already exist.
	 */
	private createChatSession() {
		if (!this.chatSession) {
			if (this.state.history.length == 1) {
				this.logger.info(`Creating new chat session`);
			} else  {
				this.logger.info(`Creating new chat session with ${this.state.history.length} history entries`);
			}

			const systemInstruction = SidekickAgent.getSystemPrompt();
			this.logger.info(`System Prompt:\n${systemInstruction}`);

			const params: CreateChatParameters = {
				model: "gemini-3-flash-preview",
				config: {
					systemInstruction: systemInstruction,
					tools: this.tools.length > 0 ? [{
						functionDeclarations: this.tools.map(t => t.getDeclaration())
					}] : undefined
				},
				history: this.state.history
					.filter((m): m is TextHistoryEntry => m.type === "text")
					.map(m => ({
						role: m.role,
						parts: [{ text: m.content }]
					}))
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

			let iterationResponse = await this.promtLLM();

            const functionCalls = iterationResponse.functionCalls;

            if (this.stopRequested || iterations >= maxIterations || !functionCalls || functionCalls.length === 0) {
                await this.finalizeLoop(iterationResponse.text ?? "", iterations, maxIterations);
                return;
            }

            iterationResponse = await this.handleFunctionCalls(iterationResponse);
        }
    }

	private async finalizeLoop(finalContent: string, iterations: number, maxIterations: number): Promise<void> {
		let postfix = "";
		if (this.stopRequested) {
			this.logger.warn("Agent loop stopped by user.");
			postfix = "\n\nAgent loop stopped by user."
		} else if (iterations >= maxIterations) {
			this.logger.warn(`Max iterations (${maxIterations}) reached. Breaking loop.`);
			postfix = "\n\nMax iterations (${maxIterations}) reached. Breaking loop."
		}

		this.setState({
			...this.state,
			history: [...this.state.history, {type: "text", role: "model", content: finalContent + postfix}]
		});
	}

	/**
     * Sends a message to the LLM with the current note context and history.
     * @returns A promise that resolves to the LLM response.
     */
    private async promtLLM(): Promise<GenerateContentResponse> {
        // Find the last user prompt in history
        const userEntries = this.state.history.filter((h): h is TextHistoryEntry => h.type === "text" && h.role === "user");
        const lastUserEntry = userEntries[userEntries.length - 1];
        const prompt = lastUserEntry ? lastUserEntry.content : "";

        // Prepare context for the prompt from notes
        const contextStr = this.state.notes.size > 0
            ? `Context of notes:\n${JSON.stringify(Array.from(this.state.notes.values()), null, 2)}\n\n`
            : "";

        // Prepare history for the prompt to make it clear we are in a loop
        const loopHistory = this.state.history.filter((h): h is ToolCallHistoryEntry => h.type === "function_call");
        const historyStr = loopHistory.length > 0
            ? `Current tool execution history in this loop:\n${JSON.stringify(loopHistory.map(h => ({
                call: h.call,
                result: "output" in h.result ? h.result.output : h.result.error
            })), null, 2)}\n\n`
            : "";

        const message = `${contextStr}${historyStr}User Question: ${prompt}`;
        this.logger.info(`Sending message: ${message}`);

        const response = await this.chatSession!.sendMessage({
            message: message,
        });

        this.logResponse(response, "to prompt the LLM");
        return response;
    }

    /**
     * Handles function calls from the model by executing tools and returning results.
     * @param iterationResponse - The model response containing function calls and potentially text.
     * @returns A promise that resolves to the tool results.
     */
    private async handleFunctionCalls(iterationResponse: GenerateContentResponse): Promise<GenerateContentResponse> {
		const functionCalls = iterationResponse.functionCalls;
		if (!functionCalls || functionCalls.length === 0) {
			return iterationResponse;
		}
        if (iterationResponse.text) {
            this.logger.info(`LLM Response: ${iterationResponse.text}`);
            this.setState({
                ...this.state,
                history: [...this.state.history, { type: "text", role: "model", content: iterationResponse.text }]
            });
        }

        const results: FunctionResponse[] = [];
        for (const call of functionCalls) {
            const tool = this.tools.find(t => t.getDeclaration().name === call.name);
            let result: ToolResult;
            if (tool) {
                const [newState, res] = await tool.execute(this.state, (call.args as Record<string, unknown>) ?? {});
                this.setState(newState);
                result = res;
                const resultText = result.verbose_result ?? ("output" in res ? res.output : res.error);
                this.logger.info(`${call.name}(${JSON.stringify(call.args)}) => ${resultText}`);
            } else {
                this.logger.warn(`Tool ${call.name} not found.`);
                result = { error: `Tool ${call.name} not found.` };
            }

            results.push({
                name: call.name,
                id: call.id,
                response: result
            });

            // Add this function call and its result to history immediately
            this.setState({
                ...this.state,
                history: [
                    ...this.state.history,
                    {
                        type: "function_call",
                        role: "model",
                        call: {
                            name: call.name!,
                            args: call.args as Record<string, unknown>
                        },
                        result: result
                    }
                ]
            });
        }
		
        const response = await this.chatSession!.sendMessage({
            message: [
                ...results.map(r => {
                    const responseBody: Record<string, unknown> = { ...r.response as Record<string, unknown> };
                    // verbose_result is for logging and LLM context, but not for the history rendering (handled in chat-view.ts)
                    // The LLM should see the verbose result if provided.
                    // If verbose_result is present, we might want to prioritize it for the LLM.
                    return {
                        functionResponse: {
                            name: r.name,
                            id: r.id,
                            response: responseBody
                        } as FunctionResponse
                    };
                }),
            ]
        });

        this.logResponse(response, "to send function responses");
        if (response.text) {
            this.logger.info(`Final model response after function calls: ${response.text}`);
        }

        return response;
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
    private logResponse(response: GenerateContentResponse, forWhat?: string): void {
        const tokens = response.usageMetadata?.totalTokenCount ?? "unknown";
        const logMsg = forWhat ? `Sent ${forWhat}, used ${tokens} tokens` : `Used ${tokens} LLM tokens`;
        this.logger.info(logMsg);
		if (response.promptFeedback) {
			this.logger.info(`Prompt feedback: ${JSON.stringify(response.promptFeedback)}`);
		}
		if (response.functionCalls && response.functionCalls.length > 0) {
            const formattedCalls = response.functionCalls.map(call => `${call.name}(${JSON.stringify(call.args)})`).join(", ");
			this.logger.info(`LLM requested: [${formattedCalls}]`);
		}
		if (response.data) {
			this.logger.info(`Response data: ${response.data}`);
		}
    }
}
