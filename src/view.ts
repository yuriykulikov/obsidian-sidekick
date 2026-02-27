import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import SidekickPlugin from "./main";
import { GoogleGenAI } from "@google/genai";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

export class SidekickView extends ItemView {
	plugin: SidekickPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: SidekickPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_SIDEKICK;
	}

	getDisplayText() {
		return "Sidekick";
	}

	getIcon() {
		return "bot";
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		container.empty();
		container.addClass("sidekick-view-container");

		const responseContainer = container.createDiv({ cls: "sidekick-response-container" });
		
		const inputContainer = container.createDiv({ cls: "sidekick-input-container" });
		const inputEl = inputContainer.createEl("textarea", {
			cls: "sidekick-input",
			attr: { placeholder: "Type a prompt..." }
		});

		const sendButton = inputContainer.createEl("button", {
			cls: "sidekick-send-button",
			text: "Send"
		});

		const sendMessage = async () => {
			const prompt = inputEl.value.trim();
			if (!prompt) return;

			const apiKey = this.plugin.settings.geminiApiKey;
			if (!apiKey) {
				new Notice("Configure API key in settings");
				return;
			}

			// Display user message
			const userMsg = responseContainer.createDiv({ cls: "sidekick-message user-message" });
			userMsg.setText("You: " + prompt);
			
			// Display placeholder for agent message
			const agentMsg = responseContainer.createDiv({ cls: "sidekick-message agent-message" });
			agentMsg.setText("Agent: thinking...");
			
			inputEl.value = "";
			responseContainer.scrollTo(0, responseContainer.scrollHeight);

			try {
				// Get current note content
				const file = this.app.workspace.getActiveFile();
				const noteContent = file ? await this.app.vault.read(file) : "";

				const systemPrompt = "You are a helpful assistant for Obsidian. Use the following note as context for the user's request.\n\n" +
					"--- NOTE CONTENT ---\n" +
					noteContent + "\n" +
					"--- END NOTE CONTENT ---\n";

				const ai = new GoogleGenAI({ apiKey });
				const result = await ai.models.generateContent({
					model: "gemini-3-flash-preview",
					contents: systemPrompt + prompt
				});

				const text = result.text;
				
				agentMsg.setText("Agent: " + text);
			} catch (error) {
				console.error("Gemini API Error:", error);
				agentMsg.setText("Agent: Error calling Gemini API. " + (error instanceof Error ? error.message : ""));
			}
			
			responseContainer.scrollTo(0, responseContainer.scrollHeight);
		};

		sendButton.addEventListener("click", () => {
			void sendMessage();
		});
		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void sendMessage();
			}
		});
	}

	async onClose() {
		// Nothing to clean up.
	}
}
