import {App, PluginSettingTab, Setting} from "obsidian";
import SidekickPlugin from "./main";

/**
 * Settings configuration for the Sidekick plugin.
 */
export interface SidekickPluginSettings {
	geminiApiKey: string;
}

export const DEFAULT_SETTINGS: SidekickPluginSettings = {
	geminiApiKey: ''
}

/**
 * The settings tab in Obsidian's configuration where the user enters the API key.
 */
export class SidekickSettingTab extends PluginSettingTab {
	plugin: SidekickPlugin;

	constructor(app: App, plugin: SidekickPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders the settings tab UI.
	 */
	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Gemini API key')
			.setDesc('Enter API key')
			.addText(text => text
				.setPlaceholder('Enter your API key')
				.setValue(this.plugin.settings.geminiApiKey)
				.onChange(async (value) => {
					this.plugin.settings.geminiApiKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
