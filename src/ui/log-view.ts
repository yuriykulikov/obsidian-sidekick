import { ItemView, type Menu, type WorkspaceLeaf } from "obsidian";
import type { LogEntry, Logger, LogListener } from "../utils/logger";
import { renderMarkdown } from "./render-markdown";

export const VIEW_TYPE_SIDEKICK_LOG = "sidekick-log-view";

export class SidekickLogView extends ItemView implements LogListener {
  private logger: Logger;
  private logContainer: HTMLElement;

  constructor(leaf: WorkspaceLeaf, logger: Logger) {
    super(leaf);
    this.logger = logger;
  }

  getViewType(): string {
    return VIEW_TYPE_SIDEKICK_LOG;
  }

  getDisplayText(): string {
    return "Sidekick log";
  }

  getIcon(): string {
    return "list-tree";
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("sidekick-log-container");

    this.logContainer = container.createDiv({ cls: "sidekick-log-messages" });

    this.logger.addListener(this);
    this.render();
  }

  onPaneMenu(menu: Menu, prev: string) {
    super.onPaneMenu(menu, prev);
    menu.addItem((item) => {
      item
        .setTitle("Clear log")
        .setIcon("trash")
        .onClick(() => {
          this.logger.clear();
        });
    });
  }

  async onClose() {
    this.logger.removeListener(this);
  }

  onLog = (entry: LogEntry) => {
    this.appendLogEntry(entry);
  };

  clear = () => {
    this.render();
  };

  private render() {
    if (!this.logContainer) return;
    this.logContainer.empty();
    const logs = this.logger.getLogs();
    for (const log of logs) {
      this.appendLogEntry(log);
    }
  }

  private appendLogEntry(entry: LogEntry) {
    if (!this.logContainer) return;
    const logEl = this.logContainer.createDiv({
      cls: `sidekick-log-entry sidekick-log-${entry.level.toLowerCase()}`,
    });

    if (entry.markdown) {
      const details = logEl.createEl("details");
      if (!entry.collapsed) {
        details.setAttribute("open", "true");
      }
      details.createEl("summary", {
        cls: "sidekick-log-message",
        text: entry.title || entry.message,
      });
      const content = details.createDiv({
        cls: "sidekick-log-markdown-content",
      });
      void renderMarkdown(this.app, entry.markdown, content, this);
    } else {
      logEl.createSpan({ cls: "sidekick-log-message", text: entry.message });
    }

    // Auto-scroll to bottom
    this.logContainer.scrollTo({ top: this.logContainer.scrollHeight });
  }
}
