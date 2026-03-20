import { App, TFile, TFolder, getAllTags } from "obsidian";
import { AgentState, Note, File, Folder } from "../types";

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

	return {
		filename: filename,
		path: file.path,
		content: detail === "text" ? content : null,
		links: [...new Set(links)],
		backlinks: [...new Set(backlinks)],
		active: false,
		structure: (detail === "structure") ? structure.join('\n') : null,
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

	return {
		...state,
		notes: newNotes
	};
}

/**
 * Lists the contents of a folder in the vault and updates the agent state.
 * 
 * @param app The Obsidian App instance.
 * @param state The current agent state.
 * @param path The path to the folder.
 * @returns A tuple of the updated agent state, the resolved folder object, and the list of items found.
 */
export async function listFolderContents(
	app: App, 
	state: AgentState, 
	path: string
): Promise<[AgentState, TFolder, (File | Folder)[]] | null> {
	let segments = path.split("/").filter(s => s.length > 0);
	const resolvedSegments: string[] = [];

	for (const segment of segments) {
		if (segment === "..") {
			resolvedSegments.pop();
		} else if (segment !== ".") {
			resolvedSegments.push(segment);
		}
	}

	let normalizedPath = resolvedSegments.join("/");
	
	// Obsidian vault root is accessed via empty string.
	// We handle both empty string and "/" by normalizing.
	let abstractFile = app.vault.getAbstractFileByPath(normalizedPath);
	
	// If not found and it was intended to be root, try "/"
	if (!abstractFile && normalizedPath === "") {
		abstractFile = app.vault.getAbstractFileByPath("/");
	}
	
	if (!abstractFile || !(abstractFile instanceof TFolder)) {
		return null;
	}

	const items: (File | Folder)[] = [];
	const folder = abstractFile;

	for (const child of folder.children) {
		if (child instanceof TFile) {
			const cache = app.metadataCache.getFileCache(child);
			const tags = cache ? (getAllTags(cache) || []) : [];

			items.push({
				filename: child.basename,
				path: child.path,
				type: "file",
				mtime: child.stat.mtime,
				tags: tags
			});
		} else if (child instanceof TFolder) {
			let recursiveCount = 0;
			const countFiles = (f: TFolder) => {
				for (const c of f.children) {
					if (c instanceof TFile) recursiveCount++;
					else if (c instanceof TFolder) countFiles(c);
				}
			};
			countFiles(child);

			items.push({
				filename: child.name,
				path: child.path,
				type: "folder",
				file_count: recursiveCount,
				children: []
			});
		}
	}

	// Update state
	const newNotes = new Map(state.notes);
	const newFolders = new Map<string, Folder>(state.folders);

	const currentDir: Folder = {
		filename: folder.name || "/",
		path: folder.path,
		type: "folder",
		file_count: 0, 
		children: items
	};

	let totalRecursiveCount = 0;
	for (const item of items) {
		if (item.type === "file") totalRecursiveCount++;
		else totalRecursiveCount += item.file_count;
	}
	currentDir.file_count = totalRecursiveCount;

	newFolders.set(currentDir.path, currentDir);

	for (const item of items) {
		if (item.type === "file") {
			const existing = newNotes.get(item.filename);
			if (existing) {
				newNotes.set(item.filename, { ...existing, parent: currentDir });
			}
		} else {
			newFolders.set(item.path, item);
		}
	}

	const newState: AgentState = {
		...state,
		notes: newNotes,
		folders: newFolders
	};

	return [newState, folder, items];
}
