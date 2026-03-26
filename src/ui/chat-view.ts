import {
  ButtonComponent,
  ItemView,
  MarkdownRenderer,
  setIcon,
  TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { SidekickAgent } from "../agent";
import type { AgentFactory } from "../agent-factory";
import type {
  AgentState,
  TextHistoryEntry,
  ToolCallHistoryEntry,
} from "../types";
import type { Logger } from "../utils/logger";
import { NoteSuggestionModal } from "./note-suggestion-modal";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

/**
 * The SidekickView class provides a custom sidebar view for interacting with the AI agent.
 */
export class ChatView extends ItemView {
  agentFactory: AgentFactory;
  agent: SidekickAgent;
  responseContainer: HTMLElement;
  notesContainer: HTMLElement;
  inputEl: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  logger: Logger;

  constructor(leaf: WorkspaceLeaf, agentFactory: AgentFactory, logger: Logger) {
    super(leaf);
    this.agentFactory = agentFactory;
    this.logger = logger;
    this.initAgent();
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

    this.renderHeader(container);
    this.responseContainer = container.createDiv({
      cls: "sidekick-response-container",
    });
    this.notesContainer = container.createDiv({
      cls: "sidekick-notes-context-container",
    });
    this.renderInputArea(container);

    this.registerEvent(
      this.app.workspace.on("file-open", async (file) => {
        if (file instanceof TFile) {
          await this.agent.setActiveNote(file.basename);
        }
      }),
    );

    await this.resetChat();
  }

  private renderHeader(container: HTMLElement) {
    const headerContainer = container.createDiv({ cls: "sidekick-header" });

    const newTaskButton = new ButtonComponent(headerContainer)
      .setButtonText("New task")
      .setTooltip("New task")
      .onClick(() => {
        void this.resetChat();
      });
    newTaskButton.buttonEl.addClass("sidekick-new-task-button");
    newTaskButton.buttonEl.addClass("sidekick-header-button");
  }

  private renderInputArea(container: HTMLElement) {
    const inputContainer = container.createDiv({
      cls: "sidekick-input-container",
    });

    const addNoteButton = new ButtonComponent(inputContainer)
      .setIcon("plus")
      .setTooltip("Add note to context")
      .onClick(() => {
        this.openNoteModal();
      });
    addNoteButton.buttonEl.addClass("sidekick-add-note-button");

    this.inputEl = inputContainer.createEl("textarea", {
      cls: "sidekick-input",
      attr: { placeholder: "Type a prompt... (use @, #, or [[ to add notes)" },
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
      cls: "sidekick-send-button",
    });
    setIcon(this.sendButton, "paper-plane");

    this.stopButton = inputContainer.createEl("button", {
      cls: "sidekick-stop-button sidekick-hidden",
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
  }

  /**
   * Opens the note suggestion modal and adds the selected note to context and input.
   */
  private openNoteModal() {
    new NoteSuggestionModal(this.app, (file: TFile) => {
      void (async () => {
        // Add to context
        await this.agent.addNote(file.basename);

        // Add to input text
        const cursor = this.inputEl.selectionStart;
        const value = this.inputEl.value;
        const before = value.substring(0, cursor);
        const after = value.substring(cursor);

        // If triggered by [[, we might want to postfix it with ]]
        let insertion = `${file.basename} `;
        if (before.endsWith("[[")) {
          insertion = `${file.basename}]] `;
        }

        this.inputEl.value = before + insertion + after;
        this.inputEl.selectionStart = this.inputEl.selectionEnd =
          cursor + insertion.length;
        this.inputEl.focus();
      })();
    }).open();
  }

  /**
   * Initializes the agent with the current state and settings.
   */
  private initAgent(): SidekickAgent {
    this.agent = this.agentFactory.createAgentInstance((state) => {
      this.render(state);
    });
    return this.agent;
  }

  /**
   * Sends the current prompt to the agent and updates the UI with the response.
   */
  async sendMessage() {
    const prompt = this.inputEl.value.trim();
    if (!prompt) return;
    this.inputEl.value = "";
    try {
      await this.agent.next(prompt);
    } catch (error) {
      this.logger.error(
        `Agent Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.error("Agent Error:", error);
    }
  }

  /**
   * Re-renders the chat history and current status.
   * Uses MarkdownRenderer to display messages and indicates if the agent is thinking.
   */
  render(state: AgentState) {
    if (!this.responseContainer || !this.notesContainer) return;
    this.responseContainer.empty();
    this.notesContainer.empty();

    this.renderNotes(state);
    this.updateActionButtons(state);

    const history = state.history;
    for (const msg of history) {
      if (msg.type === "text") {
        this.renderTextMessage(msg);
      } else if (msg.type === "function_call") {
        this.renderToolMessage(msg);
      }
    }

    if (state.isThinking) {
      const agentMsg = this.responseContainer.createDiv({
        cls: "sidekick-message agent-message",
      });
      agentMsg.createEl("em", { text: "Thinking..." });
    }

    this.scrollToBottom();
  }

  private updateActionButtons(state: AgentState) {
    if (this.sendButton && this.stopButton) {
      if (state.isThinking) {
        this.sendButton.addClass("sidekick-hidden");
        this.stopButton.removeClass("sidekick-hidden");
      } else {
        this.sendButton.removeClass("sidekick-hidden");
        this.stopButton.addClass("sidekick-hidden");
      }
    }
  }

  private renderTextMessage(msg: TextHistoryEntry) {
    if (msg.role === "user") {
      const userMsg = this.responseContainer.createDiv({
        cls: "sidekick-message user-message",
      });
      void MarkdownRenderer.render(this.app, msg.content, userMsg, "", this);
    } else {
      const agentMsg = this.responseContainer.createDiv({
        cls: "sidekick-message agent-message",
      });
      const copyBtn = agentMsg.createDiv({ cls: "sidekick-copy-button" });
      setIcon(copyBtn, "copy");
      copyBtn.addEventListener("click", () => {
        void navigator.clipboard.writeText(msg.content);
      });
      void MarkdownRenderer.render(this.app, msg.content, agentMsg, "", this);
    }
  }

  private renderToolMessage(msg: ToolCallHistoryEntry) {
    const toolMsg = this.responseContainer.createDiv({
      cls: "sidekick-message tool-message",
    });
    if ("error" in msg.result) {
      toolMsg.addClass("sidekick-tool-error");
    }
    const summary = msg.result.summary;
    toolMsg.createSpan({ text: summary, cls: "sidekick-tool-result-summary" });
    if (msg.result.verbose) {
      toolMsg.createSpan({
        text: "...",
        cls: "sidekick-tool-verbose-indicator",
      });
    }

    if (msg.result.verbose) {
      const verboseElement = toolMsg.createDiv({
        cls: "sidekick-tool-result-details",
      });
      if (msg.collapsed) {
        verboseElement.addClass("sidekick-hidden");
      }
      void MarkdownRenderer.render(
        this.app,
        msg.result.verbose,
        verboseElement,
        "",
        this,
      );

      toolMsg.addEventListener("click", () => {
        const isCollapsed = verboseElement.hasClass("sidekick-hidden");
        this.agent.setHistoryEntryCollapsed(msg.id, !isCollapsed);
        verboseElement.toggleClass(
          "sidekick-hidden",
          !verboseElement.hasClass("sidekick-hidden"),
        );
      });
    }
  }

  private scrollToBottom() {
    // Scroll to bottom after render
    setTimeout(() => {
      this.responseContainer.scrollTo(0, this.responseContainer.scrollHeight);
    }, 0);
  }

  /**
   * Renders the list of added notes that will be used as context.
   */
  private renderNotes(state: AgentState) {
    const notesWrapper = this.notesContainer.createDiv({
      cls: "sidekick-notes-context",
    });

    for (const [filename, note] of state.notes) {
      const noteTag = notesWrapper.createEl("span", {
        cls: "sidekick-note-tag",
        text: filename,
      });
      if (note.active) {
        noteTag.addClass("sidekick-note-active");
      }
      if (note.content) {
        noteTag.addClass("sidekick-note-full");
        noteTag.setAttr("title", "Full content in context");
      } else if (note.structure) {
        noteTag.addClass("sidekick-note-structure");
        noteTag.setAttr("title", "Structure only in context");
      }
      const removeBtn = noteTag.createEl("span", {
        cls: "sidekick-note-remove",
        text: " ×",
      });
      removeBtn.addEventListener("click", () => {
        this.agent.removeNote(filename);
      });
    }
  }

  async onClose() {
    // Nothing to clean up.
    this.agent.dispose();
  }

  /**
   * Resets the current chat session, clearing the agent instance and message history.
   */
  async resetChat() {
    this.agent.stop();
    this.agent.dispose();
    this.initAgent();
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.agent.setActiveNote(activeFile.basename);
    }

    if (this.inputEl) {
      this.inputEl.value = "";
    }
  }
}
