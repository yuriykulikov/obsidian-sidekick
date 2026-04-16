import { type App, PluginSettingTab, Setting } from "obsidian";
import type SidekickPlugin from "./main";

/**
 * Settings configuration for the Sidekick plugin.
 */
export interface SidekickPluginSettings {
  geminiApiKey: string;
  /**
   * Hard cap of the agent transducer-loop iterations per user prompt.
   * An iteration is one model turn plus any tool calls executed from that turn.
   */
  maxIterations: number;
}

export const DEFAULT_SETTINGS: SidekickPluginSettings = {
  geminiApiKey: "",
  maxIterations: 30,
};

/**
 * The settings tab in Obsidian's configuration where the user enters the API key.
 */
export class SidekickSettingTab extends PluginSettingTab {
  plugin: SidekickPlugin;

  private clampMaxIterations(value: number): number {
    if (!Number.isFinite(value)) return DEFAULT_SETTINGS.maxIterations;
    return Math.max(5, Math.min(100, Math.trunc(value)));
  }

  constructor(app: App, plugin: SidekickPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Renders the settings tab UI.
   */
  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Gemini API key")
      .setDesc("Enter API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Agent max iterations")
      .setDesc(
        "Hard cap on agent loop iterations per prompt (one model turn + its tool calls). Lower = faster/cheaper, higher = more thorough.",
      )
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.maxIterations))
          .setValue(String(this.plugin.settings.maxIterations))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.maxIterations =
              this.clampMaxIterations(parsed);
            await this.plugin.saveSettings();
          }),
      );
  }
}
