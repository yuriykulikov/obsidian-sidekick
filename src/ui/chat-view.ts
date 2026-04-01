import {
  ButtonComponent,
  ItemView,
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
import type { InputView } from "./input-view";
import { createMarkdownEditor } from "./markdown-input-view";
import { NoteSuggestionModal } from "./note-suggestion-modal";
import { renderMarkdown } from "./render-markdown";

export const VIEW_TYPE_SIDEKICK = "sidekick-view";

/**
 * The SidekickView class provides a custom sidebar view for interacting with the AI agent.
 */
export class ChatView extends ItemView {
  agentFactory: AgentFactory;
  agent: SidekickAgent;
  responseContainer: HTMLElement;
  notesContainer: HTMLElement;
  inputView: InputView;
  sendButton: HTMLButtonElement;
  stopButton: HTMLButtonElement;
  logger: Logger;

  constructor(leaf: WorkspaceLeaf, agentFactory: AgentFactory, logger: Logger) {
    super(leaf);
    this.agentFactory = agentFactory;
    this.logger = logger;
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

    this.agent = await this.agentFactory.restoreAgentInstance((state) => {
      this.render(state);
    });
    // This is required because otherwise [[ do not work
    this.inputView.clear();
    if (this.agent.state.notes.isEmpty()) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile) {
        await this.agent.setActiveNote(activeFile.basename);
      }
    }
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
        new NoteSuggestionModal(this.app, (file: TFile) => {
          void (async () => {
            // Add to context
            await this.agent.addNote(file.basename);
          })();
        }).open();
      });

    addNoteButton.buttonEl.addClass("sidekick-add-note-button");

    // this.inputView = PlaintextInputView.create(
    this.inputView = createMarkdownEditor(
      inputContainer,
      this.app,
      async (basename: string) => {
        await this.agent.addNote(basename);
      },
      () => {
        void this.sendMessage();
      },
    );

    this.sendButton = inputContainer.createEl("button", {
      cls: "sidekick-send-button",
    });
    setIcon(this.sendButton, "paper-plane");

    this.stopButton = inputContainer.createEl("button", {
      cls: "sidekick-stop-button sidekick-button-hidden",
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
    const prompt = this.inputView.text().trim();
    if (!prompt) return;
    this.inputView.clear();
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
        this.sendButton.addClass("sidekick-button-hidden");
        this.stopButton.removeClass("sidekick-button-hidden");
      } else {
        this.sendButton.removeClass("sidekick-button-hidden");
        this.stopButton.addClass("sidekick-button-hidden");
      }
    }
  }

  private renderTextMessage(msg: TextHistoryEntry) {
    if (msg.role === "user") {
      const userMsg = this.responseContainer.createDiv({
        cls: "sidekick-message user-message",
      });
      void renderMarkdown(this.app, msg.content, userMsg, this);
    } else {
      const agentMsg = this.responseContainer.createDiv({
        cls: "sidekick-message agent-message",
      });
      const copyBtn = agentMsg.createDiv({ cls: "sidekick-copy-button" });
      setIcon(copyBtn, "copy");
      copyBtn.addEventListener("click", () => {
        void navigator.clipboard.writeText(msg.content);
      });
      void renderMarkdown(this.app, msg.content, agentMsg, this);
    }
  }

  private renderToolMessage(msg: ToolCallHistoryEntry) {
    const toolMsg = this.responseContainer.createDiv({
      cls: "sidekick-message tool-message",
    });
    if (msg.result.isError()) {
      toolMsg.addClass("sidekick-tool-error");
    }
    const summary = msg.result.summary;
    toolMsg.createSpan({ text: summary, cls: "sidekick-tool-result-summary" });
    const verboseElement = toolMsg.createDiv({
      cls: "sidekick-tool-result-details",
    });
    if (msg.collapsed) {
      verboseElement.addClass("sidekick-button-hidden");
    }
    void renderMarkdown(
      this.app,
      msg.result.llmOutputString(),
      verboseElement,
      this,
    );

    toolMsg.addEventListener("click", () => {
      const isCollapsed = verboseElement.hasClass("sidekick-button-hidden");
      this.agent.setHistoryEntryCollapsed(msg.id, !isCollapsed);
      verboseElement.toggleClass(
        "sidekick-button-hidden",
        !verboseElement.hasClass("sidekick-button-hidden"),
      );
    });
  }

  private scrollToBottom() {
    // Scroll to bottom after render
    setTimeout(() => {
      this.responseContainer.scrollTo({
        top: this.responseContainer.scrollHeight,
      });
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
    this.logger.clear();
    this.initAgent();
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
      await this.agent.setActiveNote(activeFile.basename);
    }

    if (this.inputView) {
      this.inputView.clear();
    }
  }
}
