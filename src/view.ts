import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, ButtonComponent, setIcon, TFile } from "obsidian";
import SidekickPlugin from "./main";
import { SidekickAgent } from "./agent";
import { SidekickAgentState, createInitialState } from "./types";
import { addNote, setActiveNote } from "./utils/notes";
import { NoteSuggestionModal } from "./ui/note-suggestion-modal";
import { GetNotesTool } from "./tools/get-notes";

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
	notesContainer: HTMLElement;
	inputEl: HTMLTextAreaElement;
	sendButton: HTMLButtonElement;
	stopButton: HTMLButtonElement;

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
				void this.resetChat();
			});
		newTaskButton.buttonEl.addClass("sidekick-new-task-button");
		newTaskButton.buttonEl.addClass("sidekick-header-button");

		this.responseContainer = container.createDiv({ cls: "sidekick-response-container" });
		this.notesContainer = container.createDiv({ cls: "sidekick-notes-context-container" });
		const inputContainer = container.createDiv({ cls: "sidekick-input-container" });

		const addNoteButton = new ButtonComponent(inputContainer)
			.setIcon("plus")
			.setTooltip("Add note to context")
			.onClick(() => {
				this.openNoteModal();
			});
		addNoteButton.buttonEl.addClass("sidekick-add-note-button");

		this.inputEl = inputContainer.createEl("textarea", {
			cls: "sidekick-input",
			attr: { placeholder: "Type a prompt... (use @, #, or [[ to add notes)" }
		});

		this.inputEl.addEventListener("input", () => {
			const value = this.inputEl.value;
			const cursor = this.inputEl.selectionStart;
			const lastChar = value.charAt(cursor - 1);
			const lastTwoChars = value.substring(cursor - 2, cursor);

			if (lastChar === "@" || lastChar === "#" || lastTwoChars === "[[") {
				this.openNoteModal();
			}
		});

		this.sendButton = inputContainer.createEl("button", {
			cls: "sidekick-send-button"
		});
		setIcon(this.sendButton, "paper-plane");

		this.stopButton = inputContainer.createEl("button", {
			cls: "sidekick-stop-button sidekick-hidden"
		});
		setIcon(this.stopButton, "circle-stop");

		this.sendButton.addEventListener("click", () => {
			void this.sendMessage();
		});

		this.stopButton.addEventListener("click", () => {
			if (this.agent) {
				this.agent.stop();
			}
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.sendMessage();
			}
		});

		this.initAgent();

		this.registerEvent(this.app.workspace.on("file-open", async (file) => {
			if (file instanceof TFile) {
				const newState = await setActiveNote(this.app, this.state, file.basename);
				if (this.agent) {
					this.agent.setState(newState);
				} else {
					this.state = newState;
					this.render();
				}
			}
		}));

		await this.resetChat();
	}

	/**
	 * Opens the note suggestion modal and adds the selected note to context and input.
	 */
	private openNoteModal() {
		new NoteSuggestionModal(this.app, (file: TFile) => {
			void (async () => {
				// Add to context
				this.state = await addNote(this.app, this.state, file.basename);
				if (this.agent) {
					this.agent.state = this.state;
				}
				this.render();

				// Add to input text
				const cursor = this.inputEl.selectionStart;
				const value = this.inputEl.value;
				const before = value.substring(0, cursor);
				const after = value.substring(cursor);

				// If triggered by [[, we might want to postfix it with ]]
				let insertion = file.basename + " ";
				if (before.endsWith("[[")) {
					insertion = file.basename + "]] ";
				}

				this.inputEl.value = before + insertion + after;
				this.inputEl.selectionStart = this.inputEl.selectionEnd = cursor + insertion.length;
				this.inputEl.focus();
			})();
		}).open();
	}

	/**
	 * Initializes the agent with the current state and settings.
	 */
	private initAgent(): boolean {
		const apiKey = this.plugin.settings.geminiApiKey;
		if (!apiKey) {
			return false;
		}

		this.agent = new SidekickAgent(
			this.app,
			apiKey,
			this.state,
			this.plugin.logger,
			[new GetNotesTool(this.app, this.plugin.logger)],
			(state) => {
				this.state = state;
				this.render();
			}
		);
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
			await this.agent!.next(prompt);
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
		if (!this.responseContainer || !this.notesContainer) return;
		this.responseContainer.empty();
		this.notesContainer.empty();

		this.renderNotes();

		if (this.sendButton && this.stopButton) {
			if (this.isThinking) {
				this.sendButton.addClass("sidekick-hidden");
				this.stopButton.removeClass("sidekick-hidden");
			} else {
				this.sendButton.removeClass("sidekick-hidden");
				this.stopButton.addClass("sidekick-hidden");
			}
		}

		const history = this.state.history;
		for (const msg of history) {
			if (msg.type === "text") {
				if (msg.role === "user") {
					const userMsg = this.responseContainer.createDiv({ cls: "sidekick-message user-message" });
					void MarkdownRenderer.render(this.app,  msg.content, userMsg, "", this);
				} else {
					const agentMsg = this.responseContainer.createDiv({ cls: "sidekick-message agent-message" });
					const copyBtn = agentMsg.createDiv({ cls: "sidekick-copy-button" });
				setIcon(copyBtn, "copy");
				copyBtn.addEventListener("click", () => {
					void navigator.clipboard.writeText(msg.content); });
					void MarkdownRenderer.render(this.app, msg.content, agentMsg, "", this);
				}
			} else if (msg.type === "function_call") {
				const toolMsg = this.responseContainer.createDiv({ cls: "sidekick-message tool-message" });
				const resultText = "output" in msg.result ? msg.result.output : msg.result.error;
				toolMsg.createSpan({ text: resultText, cls: "sidekick-tool-result-summary" });
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

	/**
	 * Renders the list of added notes that will be used as context.
	 */
	private renderNotes() {
		const notesWrapper = this.notesContainer.createDiv({ cls: "sidekick-notes-context" });

		for (const [filename, note] of this.state.notes) {
			const noteTag = notesWrapper.createEl("span", { cls: "sidekick-note-tag", text: filename });
			if (note.active) {
				noteTag.addClass("sidekick-note-active");
			}
			const removeBtn = noteTag.createEl("span", { cls: "sidekick-note-remove", text: " ×" });
			removeBtn.addEventListener("click", () => {
				const newNotes = new Map(this.state.notes);
				newNotes.delete(filename);
				this.state = {
					...this.state,
					notes: newNotes
				};
				if (this.agent) {
					this.agent.state = this.state;
				}
				this.render();
			});
		}
	}

	async onClose() {
		// Nothing to clean up.
	}

	/**
	 * Resets the current chat session, clearing the agent instance and message history.
	 */
	async resetChat() {
		if (this.agent) {
			this.agent.stop();
		}
		this.agent = null;
		this.state = createInitialState();
		this.isThinking = false;
		if (this.inputEl) {
			this.inputEl.value = "";
		}

		const activeFile = this.app.workspace.getActiveFile();
		if (activeFile) {
			this.state = await setActiveNote(this.app, this.state, activeFile.basename);
		}

		this.render();
	}
}
