import {App, PluginSettingTab, Setting} from "obsidian";
import SidekickPlugin from "./main";

export interface SidekickPluginSettings {
	geminiApiKey: string;
}

export const DEFAULT_SETTINGS: SidekickPluginSettings = {
	geminiApiKey: ''
}

export class SidekickSettingTab extends PluginSettingTab {
	plugin: SidekickPlugin;

	constructor(app: App, plugin: SidekickPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

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
