import { ItemView, WorkspaceLeaf, Menu } from "obsidian";
import { LogEntry, Logger } from "../utils/logger";

export const VIEW_TYPE_SIDEKICK_LOG = "sidekick-log-view";

export class SidekickLogView extends ItemView {
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
		
		this.logger.addListener(this.onLogAdded);
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
					this.render();
				});
		});
	}

	async onClose() {
		this.logger.removeListener(this.onLogAdded);
	}

	private onLogAdded = (entry: LogEntry) => {
		this.appendLogEntry(entry);
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
		const logEl = this.logContainer.createDiv({ cls: `sidekick-log-entry sidekick-log-${entry.level.toLowerCase()}` });
		const timeStr = entry.timestamp.toLocaleTimeString();
		logEl.createSpan({ cls: "sidekick-log-time", text: `[${timeStr}] ` });
		logEl.createSpan({ cls: "sidekick-log-level", text: `${entry.level}: ` });
		logEl.createSpan({ cls: "sidekick-log-message", text: entry.message });
		
		// Auto-scroll to bottom
		this.logContainer.scrollTo(0, this.logContainer.scrollHeight);
	}
}
