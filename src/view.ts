import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, ButtonComponent, setIcon } from "obsidian";
import SidekickPlugin from "./main";
import { SidekickAgent } from "./agent";
import { SidekickAgentState, createInitialState } from "./types";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

/**
 * The SidekickView class provides a custom sidebar view for interacting with the AI agent.
 */
export class SidekickView extends ItemView {
	plugin: SidekickPlugin;
	agent: SidekickAgent | null = null;
	state: SidekickAgentState;
	isThinking: boolean = false;
	responseContainer: HTMLElement;
	inputEl: HTMLTextAreaElement;

	constructor(leaf: WorkspaceLeaf, plugin: SidekickPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.state = createInitialState();
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

	/**
	 * Initializes the view's UI components, including the chat history container,
	 * input textarea, and send button.
	 */
	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		if (!container) return;
		container.empty();
		container.addClass("sidekick-view-container");

		const headerContainer = container.createDiv({ cls: "sidekick-header" });
		const newTaskButton = new ButtonComponent(headerContainer)
			.setButtonText("New task")
			.setTooltip("New task")
			.onClick(() => {
				this.resetChat();
			});
		newTaskButton.buttonEl.addClass("sidekick-new-task-button");

		this.responseContainer = container.createDiv({ cls: "sidekick-response-container" });

		const inputContainer = container.createDiv({ cls: "sidekick-input-container" });
		this.inputEl = inputContainer.createEl("textarea", {
			cls: "sidekick-input",
			attr: { placeholder: "Type a prompt..." }
		});

		const sendButton = inputContainer.createEl("button", {
			cls: "sidekick-send-button"
		});
		setIcon(sendButton, "paper-plane");

		sendButton.addEventListener("click", () => {
			void this.sendMessage();
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.sendMessage();
			}
		});

		this.initAgent();
		this.render();
	}

	/**
	 * Initializes the agent with the current state and settings.
	 */
	private initAgent(): boolean {
		const apiKey = this.plugin.settings.geminiApiKey;
		if (!apiKey) {
			return false;
		}

		this.agent = new SidekickAgent(this.app, apiKey, this.state, this.plugin.logger);
		return true;
	}

	/**
	 * Sends the current prompt to the agent and updates the UI with the response.
	 */
	async sendMessage() {
		const prompt = this.inputEl.value.trim();
		if (!prompt) return;

		if (!this.agent && !this.initAgent()) {
			new Notice("Configure API key in settings");
			return;
		}

		this.isThinking = true;
		this.inputEl.value = "";
		this.render();

		try {
			const response = await this.agent!.next(prompt);
			this.state = response.newState;
		} catch (error) {
			this.plugin.logger.error(`Agent Error: ${error instanceof Error ? error.message : String(error)}`);
			console.error("Agent Error:", error);
		} finally {
			this.isThinking = false;
			this.render();
		}
	}

	/**
	 * Re-renders the chat history and current status.
	 * Uses MarkdownRenderer to display messages and indicates if the agent is thinking.
	 */
	render() {
		if (!this.responseContainer) return;
		this.responseContainer.empty();

		const history = this.state.history;
		for (const msg of history) {
			if (msg.role === "user") {
				const userMsg = this.responseContainer.createDiv({ cls: "sidekick-message user-message" });
				void MarkdownRenderer.render(this.app, msg.content, userMsg, "", this);
			} else if (msg.role === "model") {
				const agentMsg = this.responseContainer.createDiv({ cls: "sidekick-message agent-message" });
				void MarkdownRenderer.render(this.app, msg.content, agentMsg, "", this);
			}
		}

		if (this.isThinking) {
			const agentMsg = this.responseContainer.createDiv({ cls: "sidekick-message agent-message" });
			agentMsg.createEl("em", { text: "Thinking..." });
		}

		// Scroll to bottom after render
		setTimeout(() => {
			this.responseContainer.scrollTo(0, this.responseContainer.scrollHeight);
		}, 0);
	}

	async onClose() {
		// Nothing to clean up.
	}

	/**
	 * Resets the current chat session, clearing the agent instance and message history.
	 */
	resetChat() {
		this.plugin.logger.info("Resetting chat");
		this.agent = null;
		this.state = createInitialState();
		this.isThinking = false;
		if (this.inputEl) {
			this.inputEl.value = "";
		}
		this.render();
	}
}
