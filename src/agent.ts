import { App } from "obsidian";
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { SidekickAgentState, AgentResponse, Note } from "./types";
import { SidekickLogger } from "./logger";

export class SidekickAgent {
    private genAI: GoogleGenAI;
    private chatSession: Chat | null = null;
    app: App;
    state: SidekickAgentState;
    logger: SidekickLogger;

    /**
     * Returns the default system prompt for the agent.
     * @returns The system prompt string.
     */
    static getSystemPrompt(): string {
        return `You are a helpful assistant for Obsidian. 
Answer the question or ask user a follow-up question based on the provided notes context.
Always respond in markdown format. When answering, focus on the user's request.`;
    }

    /**
     * Initializes a new instance of the SidekickAgent.
     * @param app - The Obsidian App instance.
     * @param apiKey - The Google Gemini API key.
     * @param state - The initial agent state.
     * @param logger - The logger instance.
     */
    constructor(app: App, apiKey: string, state: SidekickAgentState, logger: SidekickLogger) {
        this.app = app;
        this.genAI = new GoogleGenAI({ apiKey });
        this.state = state;
        this.logger = logger;
    }

    /**
     * Processes the next user prompt by updating the state and running the agent loop.
     * @param userPrompt - The user's input message.
     * @returns A promise that resolves to the agent's response.
     */
    async next(userPrompt: string): Promise<AgentResponse> {
        // Add current user message to state history
        this.state = {
            ...this.state,
            history: [...this.state.history, { type: "text", role: "user", content: userPrompt }]
        };

        await this.addCurrentNote();

        return await this.agentLoop(userPrompt);
    }

    /**
     * Adds the currently active file in Obsidian to the agent's context if not already present.
     * @returns A promise that resolves when the operation is complete.
     */
    private async addCurrentNote(): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const filename = activeFile.basename;
            if (!this.state.notes.has(filename)) {
                this.logger.info(`Adding current note [[${filename}]]`);
                const content = await this.app.vault.read(activeFile);
                const newNote: Note = {
                    filename: filename,
                    content: content
                };

                const newNotes = new Map(this.state.notes);
                newNotes.set(filename, newNote);

                this.state = {
                    ...this.state,
                    notes: newNotes
                };
            }
        }
    }

	/**
	 * Initializes the chat session if it doesn't already exist.
	 */
	private createChatSession() {
		if (!this.chatSession) {
			this.logger.info(`Creating new chat session with ${history.length} history entries`);
			this.chatSession = this.genAI.chats.create({
				model: "gemini-3-flash-preview",
				config: {
					systemInstruction: SidekickAgent.getSystemPrompt(),
				},
				history: this.state.history.filter(m => m.role === "user" || m.role === "model").map(m => ({
					role: m.role,
					parts: [{ text: m.content }]
				}))
			});
		}
	}

    /**
     * Internal agent loop that manages the chat session and generates a response.
     * @param userPrompt - The user's input message.
     * @returns A promise that resolves to the agent's response.
     */
    private async agentLoop(userPrompt: string): Promise<AgentResponse> {
        this.createChatSession();

        // Prepare context for the prompt from notes
        let contextStr = "";
        for (const [noteName, note] of this.state.notes) {
            contextStr += `--- START NOTE: ${noteName} ---\n`;
            if (note.content) contextStr += `Content:\n${note.content}\n\n`;
            contextStr += `--- END NOTE: ${noteName} ---\n\n`;
        }

        const enhancedPrompt = `Context of notes:\n${contextStr}\n\nUser Question: ${userPrompt}`;

        this.logger.info("Sending message to LLM...");
        const response = await this.chatSession!.sendMessage({
            message: enhancedPrompt,
        });
        const text = response.text ?? "";
		this.logResponse(response);

        // Final answer
        this.state = {
            ...this.state,
            history: [...this.state.history, { type: "text", role: "model", content: text }]
        };

        return {
            type: "final",
            content: text,
            newState: this.state
        };
    }

    /**
     * Logs detailed information about the LLM response.
     * @param response - The GenerateContentResponse from the model.
     */
    private logResponse(response: GenerateContentResponse): void {
        const tokens = response.usageMetadata?.totalTokenCount ?? "unknown";
        const finishReason = response.candidates?.[0]?.finishReason ?? "unknown";
        this.logger.info(`Received response from LLM. Tokens: ${tokens}, Finish reason: ${finishReason}`);
		if (response.promptFeedback) {
			this.logger.info(`Prompt feedback: ${JSON.stringify(response.promptFeedback)}`);
		}
		if (response.functionCalls && response.functionCalls.length > 0) {
			this.logger.info(`Function calls: ${JSON.stringify(response.functionCalls)}`);
		}
		if (response.data) {
			this.logger.info(`Response data: ${response.data}`);
		}
    }
}
