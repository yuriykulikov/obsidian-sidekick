import { Plugin, type WorkspaceLeaf } from "obsidian";
import { AgentFactory } from "./agent-factory";
import {
  DEFAULT_SETTINGS,
  type SidekickPluginSettings,
  SidekickSettingTab,
} from "./settings";
import { ChatView, VIEW_TYPE_SIDEKICK } from "./ui/chat-view";
import { SidekickLogView, VIEW_TYPE_SIDEKICK_LOG } from "./ui/log-view";
import { Logger } from "./utils/logger";

/**
 * `SidekickPlugin` is the entry point for the Obsidian Sidekick plugin.
 *
 * It manages the plugin lifecycle and acts as the root of the **Dependency
 * Injection** chain, initializing the `AgentFactory` and the plugin's views.
 *
 * NOTE: This is the source file for `main.js`. Do not modify `main.js` directly.
 */
export default class SidekickPlugin extends Plugin {
  settings: SidekickPluginSettings;
  logger: Logger;

  /**
   * Called when the plugin is loaded by Obsidian.
   * Registers the sidekick view, adds the ribbon icon, and initializes settings.
   */
  async onload() {
    this.logger = new Logger();
    await this.loadSettings();

    const agentFactory = new AgentFactory(
      this.app,
      this.logger,
      () => this.settings.geminiApiKey,
    );

    this.registerView(
      VIEW_TYPE_SIDEKICK,
      (leaf) => new ChatView(leaf, agentFactory, this.logger),
    );

    this.registerView(
      VIEW_TYPE_SIDEKICK_LOG,
      (leaf) => new SidekickLogView(leaf, this.logger),
    );

    this.addRibbonIcon("bot", "Sidekick", (_evt: MouseEvent) => {
      void this.activateView();
    });

    this.addCommand({
      id: "open-sidekick-log",
      name: "Open log",
      callback: () => this.activateLogView(),
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SidekickSettingTab(this.app, this));
  }

  onunload() {}

  /**
   * Loads plugin settings from Obsidian's data storage.
   */
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      (await this.loadData()) as Partial<SidekickPluginSettings>,
    );
  }

  /**
   * Saves plugin settings to Obsidian's data storage.
   */
  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Opens or reveals a view in the workspace by its type.
   */
  private async activateViewByType(viewType: string) {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(viewType);

    if (leaves.length > 0) {
      const existingLeaf = leaves[0];
      if (existingLeaf) {
        leaf = existingLeaf;
      }
    } else {
      leaf = workspace.getRightLeaf(false);
    }

    if (leaf) {
      void leaf.setViewState({
        type: viewType,
        active: true,
      });

      void workspace.revealLeaf(leaf);
    }
  }

  /**
   * Opens or reveals the Sidekick view in the workspace.
   */
  async activateView() {
    await this.activateViewByType(VIEW_TYPE_SIDEKICK);
  }

  /**
   * Opens or reveals the Sidekick Log view in the workspace.
   */
  async activateLogView() {
    await this.activateViewByType(VIEW_TYPE_SIDEKICK_LOG);
  }
}
