import {Plugin, WorkspaceLeaf} from 'obsidian';
import {DEFAULT_SETTINGS, SidekickPluginSettings, SidekickSettingTab} from "./settings";
import {SidekickView, VIEW_TYPE_SIDEKICK} from "./view";

export default class SidekickPlugin extends Plugin {
	settings: SidekickPluginSettings;

	/**
	 * Called when the plugin is loaded by Obsidian.
	 * Registers the sidekick view, adds the ribbon icon, and initializes settings.
	 */
	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_SIDEKICK,
			(leaf) => new SidekickView(leaf, this)
		);

		this.addRibbonIcon('bot', 'Sidekick', (evt: MouseEvent) => {
			void this.activateView();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SidekickSettingTab(this.app, this));
	}

	onunload() {
	}

	/**
	 * Loads plugin settings from Obsidian's data storage.
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<SidekickPluginSettings>);
	}

	/**
	 * Saves plugin settings to Obsidian's data storage.
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Opens or reveals the Sidekick view in the workspace.
	 */
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
			void leaf.setViewState({
				type: VIEW_TYPE_SIDEKICK,
				active: true,
			});

			void workspace.revealLeaf(leaf);
		}
	}
}
