import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

export class SidekickView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
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
		const container = this.containerEl.children[1];
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

		const sendMessage = () => {
			const prompt = inputEl.value.trim();
			if (prompt) {
				const userMsg = responseContainer.createDiv({ cls: "sidekick-message user-message" });
				userMsg.setText("You: " + prompt);
				
				const agentMsg = responseContainer.createDiv({ cls: "sidekick-message agent-message" });
				agentMsg.setText("Agent: " + prompt);
				
				inputEl.value = "";
				responseContainer.scrollTo(0, responseContainer.scrollHeight);
			}
		};

		sendButton.addEventListener("click", sendMessage);
		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				sendMessage();
			}
		});
	}

	async onClose() {
		// Nothing to clean up.
	}
}
