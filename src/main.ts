import {App, Editor, MarkdownView, Modal, Notice, Plugin, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, SidekickPluginSettings, SidekickSettingTab} from "./settings";
import {SidekickView, VIEW_TYPE_SIDEKICK} from "./view";

export default class SidekickPlugin extends Plugin {
	settings: SidekickPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_SIDEKICK,
			(leaf) => new SidekickView(leaf, this)
		);

		this.addRibbonIcon('bot', 'Sidekick', (evt: MouseEvent) => {
			this.activateView();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SidekickSettingTab(this.app, this));
	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<SidekickPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_SIDEKICK);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			const existingLeaf = leaves[0];
			if (existingLeaf) {
				leaf = existingLeaf;
			}
		} else {
			leaf = workspace.getRightLeaf(false);
		}

		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_SIDEKICK,
				active: true,
			});

			workspace.revealLeaf(leaf);
		}
	}
}
