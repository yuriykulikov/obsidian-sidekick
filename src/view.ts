import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, ButtonComponent } from "obsidian";
import SidekickPlugin from "./main";
import { GoogleGenAI, Chat } from "@google/genai";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

export class SidekickView extends ItemView {
	plugin: SidekickPlugin;
	chatSession: Chat | null = null;
	responseContainer: HTMLElement;

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

		const headerContainer = container.createDiv({ cls: "sidekick-header" });
		new ButtonComponent(headerContainer)
			.setButtonText("New task")
			.onClick(() => {
				this.resetChat();
			});

		this.responseContainer = container.createDiv({ cls: "sidekick-response-container" });
		
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
			const userMsg = this.responseContainer.createDiv({ cls: "sidekick-message user-message" });
			await MarkdownRenderer.render(this.app, "**You:** " + prompt, userMsg, "", this);
			
			// Display placeholder for agent message
			const agentMsg = this.responseContainer.createDiv({ cls: "sidekick-message agent-message" });
			agentMsg.createEl("em", { text: "Agent: thinking..." });
			
			inputEl.value = "";
			this.responseContainer.scrollTo(0, this.responseContainer.scrollHeight);

			try {
				if (!this.chatSession) {
					// Get current note content for the first message in the session
					const file = this.app.workspace.getActiveFile();
					const noteContent = file ? await this.app.vault.read(file) : "";

					const systemPrompt = "You are a helpful assistant for Obsidian. Use the following note as context for the user's request. Always respond in markdown format.\n\n" +
						"--- NOTE CONTENT ---\n" +
						noteContent + "\n" +
						"--- END NOTE CONTENT ---\n";

					const ai = new GoogleGenAI({ apiKey });
					this.chatSession = ai.chats.create({
						model: "gemini-3-flash-preview",
						config: {
							systemInstruction: systemPrompt,
						}
					});
				}

				const response = await this.chatSession.sendMessage({
					message: prompt,
				});
				const text = response.text ?? "";
				
				agentMsg.empty();
				agentMsg.createDiv({ text: "Agent:" });
				await MarkdownRenderer.render(this.app, text, agentMsg, "", this);
			} catch (error) {
				console.error("Gemini API Error:", error);
				agentMsg.empty();
				agentMsg.createDiv({ text: "Agent:" });
				await MarkdownRenderer.render(this.app, "Error calling Gemini API. " + (error instanceof Error ? error.message : ""), agentMsg, "", this);
			}
			
			this.responseContainer.scrollTo(0, this.responseContainer.scrollHeight);
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

	resetChat() {
		this.chatSession = null;
		if (this.responseContainer) {
			this.responseContainer.empty();
		}
	}
}
