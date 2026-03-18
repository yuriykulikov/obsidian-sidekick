import { App, Notice, TFile } from "obsidian";
import { SidekickAgentState, Note } from "../types";

/**
 * Reads a note's content, links, and backlinks.
 */
export async function readNote(app: App, file: TFile): Promise<Note> {
	const filename = file.basename;
	const content = await app.vault.read(file);

	const links: string[] = [];
	const backlinks: string[] = [];

	const cache = app.metadataCache.getFileCache(file);
	if (cache?.links) {
		for (const link of cache.links) {
			links.push(link.link);
		}
	}

	const resolvedLinks = app.metadataCache.resolvedLinks;
	for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
		if (targets[file.path]) {
			const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
			if (sourceFile instanceof TFile) {
				backlinks.push(sourceFile.basename);
			}
		}
	}

	return {
		filename: filename,
		content: content,
		links: [...new Set(links)],
		backlinks: [...new Set(backlinks)],
		active: false
	};
}

/**
 * Sets the active note in the agent's context.
 * 1. If no prompts in history, remove the old active note(s)
 * 2. If prompts in history, just deactivate the old active note(s)
 * 3. Add/set the new note to active
 */
export async function setActiveNote(app: App, state: SidekickAgentState, basename: string): Promise<SidekickAgentState> {
	const hasPrompts = state.history.some(entry => entry.role === "user");
	const notesCopy = new Map<string, Note>(state.notes);

	// Deactivate or remove other active notes
	for (const [name, note] of notesCopy) {
		if (note.active && name !== basename) {
			if (hasPrompts) {
				notesCopy.set(name, { ...note, active: false });
			} else {
				notesCopy.delete(name);
			}
		}
	}

	// Add or activate the target note
	let current = notesCopy.get(basename);
	if (!current) {
		const file = app.metadataCache.getFirstLinkpathDest(basename, "");
		if (file) {
			current = await readNote(app, file);
		}
	}

	if (current) {
		notesCopy.set(basename, { ...current, active: true });
	}

	return { ...state, notes: notesCopy };
}

/**
 * Adds a note to the agent's context by its basename.
 */
export async function addNote(app: App, state: SidekickAgentState, basename: string): Promise<SidekickAgentState> {
	if (state.notes.has(basename)) {
		return state;
	}

	const file = app.metadataCache.getFirstLinkpathDest(basename, "");
	if (!file) {
		new Notice(`Note [[${basename}]] not found`);
		return state;
	}

	const newNote = await readNote(app, file);

	const newNotes = new Map(state.notes);
	newNotes.set(basename, newNote);

	return {
		...state,
		notes: newNotes
	};
}
