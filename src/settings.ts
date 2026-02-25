import {App, PluginSettingTab, Setting} from "obsidian";
import SidekickPlugin from "./main";

export interface SidekickPluginSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: SidekickPluginSettings = {
	mySetting: 'default'
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
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
