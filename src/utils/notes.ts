import { App, Notice } from "obsidian";
import { SidekickAgentState, Note } from "../types";

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

	const content = await app.vault.read(file);
	const newNote: Note = {
		filename: basename,
		content: content
	};

	const newNotes = new Map(state.notes);
	newNotes.set(basename, newNote);

	return {
		...state,
		notes: newNotes
	};
}
