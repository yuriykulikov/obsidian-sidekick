import { App, TFile } from "obsidian";
import { AgentState, Note } from "../types";

/**
 * Reads a note's content, links, and backlinks.
 */
export async function readNote(app: App, file: TFile, detail: "structure" | "text" = "text"): Promise<Note> {
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

	const structure = content.split('\n').map(line => {
		const trimmed = line.trim();
		if (trimmed.startsWith("# ") || trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
			return trimmed;
		}
		if (trimmed.includes("[[")) {
			const linkRegex = /\[\[(.*?)(?:\|.*?)?]]/g;
			const linksFound = [];
			let match;
			while ((match = linkRegex.exec(trimmed)) !== null) {
				linksFound.push(match[1]);
			}
			if (linksFound.length > 0) {
				return `Links: ${linksFound.join(", ")}`;
			}
		}
		return null;
	}).filter((line): line is string => line !== null);

	const parentFolder = file.parent;
	let folderSiblings: string[] = [];
	if (parentFolder) {
		folderSiblings = parentFolder.children
			.filter(child => child instanceof TFile && child.extension === "md" && child.path !== file.path)
			.map(child => child.name);
	}

	return {
		filename: filename,
		path: file.path,
		content: detail === "text" ? content : null,
		links: [...new Set(links)],
		backlinks: [...new Set(backlinks)],
		active: false,
		structure: (detail === "structure") ? structure.join('\n') : null,
		parentPath: parentFolder?.path || "/",
		folderSiblings: folderSiblings
	};
}

/**
 * Sets the active note in the agent's context.
 * 1. If no prompts in history, remove the old active note(s)
 * 2. If prompts in history, just deactivate the old active note(s)
 * 3. Add/set the new note to active
 */
export async function setActiveNote(app: App, state: AgentState, basename: string): Promise<AgentState> {
	const hasPrompts = state.history.some(entry => entry.role === "user");
	const notesCopy = new Map<string, Note>(state.notes);
	let discoveredStructure = [...state.discoveredStructure];

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
			discoveredStructure = Array.from(new Set([...discoveredStructure, file.path]));
		}
	}

	if (current) {
		notesCopy.set(basename, { ...current, active: true });
	}

	return { ...state, notes: notesCopy, discoveredStructure };
}

/**
 * Adds a note to the agent's context by its basename.
 */
export async function addNote(app: App, state: AgentState, basename: string): Promise<AgentState> {
	if (state.notes.has(basename)) {
		return state;
	}

	const file = app.metadataCache.getFirstLinkpathDest(basename, "");
	if (!file) {
		return state;
	}

	const newNote = await readNote(app, file);

	const newNotes = new Map(state.notes);
	newNotes.set(basename, newNote);

	const newDiscoveredStructure = Array.from(new Set([...state.discoveredStructure, file.path]));

	return {
		...state,
		notes: newNotes,
		discoveredStructure: newDiscoveredStructure
	};
}

/**
 * Renders a list of paths as a markdown tree.
 */
export function renderDiscoveredStructure(paths: readonly string[]): string {
	if (paths.length === 0) {
		return "No structure discovered yet.";
	}

	interface TreeNode {
		[key: string]: TreeNode;
	}

	const sortedPaths = [...paths].sort();
	const root: TreeNode = {};

	for (const path of sortedPaths) {
		const parts = path.split("/");
		let current = root;
		for (const part of parts) {
			if (!current[part]) {
				current[part] = {};
			}
			current = current[part];
		}
	}

	let tree = "";
	const buildTree = (obj: TreeNode, indent: number = 0) => {
		const keys = Object.keys(obj).sort();
		for (const key of keys) {
			const child = obj[key];
			if (child) {
				const isFolder = Object.keys(child).length > 0;
				tree += "  ".repeat(indent) + (isFolder ? "- 📁 " : "- 📄 ") + key + "\n";
				buildTree(child, indent + 1);
			}
		}
	};

	buildTree(root);
	return tree.trim();
}

