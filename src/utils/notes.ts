import { type App, TFile } from "obsidian";
import { AgentState, type Note } from "../types";

/**
 * Reads a note's content, links, and backlinks.
 */
export async function readNote(
  app: App,
  file: TFile,
  detail: "links" | "structure" | "text",
): Promise<Note> {
  const filename = file.basename;
  const content = await app.vault.read(file);

  const links: string[] = [];
  const backlinks: string[] = [];
  const tags: string[] = [];

  const cache = app.metadataCache.getFileCache(file);
  if (cache?.links) {
    for (const link of cache.links) {
      links.push(link.link);
    }
  }

  if (cache?.tags) {
    for (const tag of cache.tags) {
      tags.push(tag.tag);
    }
  }

  if (cache?.frontmatter?.tags) {
    const fmTags = cache.frontmatter.tags;
    if (Array.isArray(fmTags)) {
      for (const tag of fmTags) {
        tags.push(
          typeof tag === "string" && !tag.startsWith("#") ? `#${tag}` : tag,
        );
      }
    } else if (typeof fmTags === "string") {
      for (const tag of fmTags.split(/[\s,]+/)) {
        if (tag) {
          tags.push(tag.startsWith("#") ? tag : `#${tag}`);
        }
      }
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

  const structure = content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("# ") ||
        trimmed.startsWith("## ") ||
        trimmed.startsWith("### ")
      ) {
        return trimmed;
      }
      const linksFound = extractLinks(trimmed);
      if (linksFound.length > 0) {
        return `Links: ${linksFound.join(", ")}`;
      }
      return null;
    })
    .filter((line): line is string => line !== null);

  const parentFolder = file.parent;
  let folderSiblings: string[] = [];
  if (parentFolder) {
    folderSiblings = parentFolder.children
      .filter(
        (child) =>
          child instanceof TFile &&
          child.extension === "md" &&
          child.path !== file.path,
      )
      .map((child) => (child as TFile).basename);
  }

  const structureOrText = detail === "structure" || detail === "text";
  return {
    filename: filename,
    path: file.path,
    content: detail === "text" ? content : null,
    links: [...new Set(links)],
    backlinks: [...new Set(backlinks)],
    tags: [...new Set(tags)],
    active: false,
    structure: structureOrText ? structure.join("\n") : null,
    parentPath: parentFolder?.path || "/",
    folderSiblings: structureOrText ? folderSiblings : null,
  };
}

/**
 * Renders a note's context for the LLM.
 */
export function renderNoteToMarkdown(note: Note): string {
  let noteMd = `## Note [[${note.filename}]]\n`;
  noteMd += `Path: ${note.path}\n`;

  noteMd += "### Links\n";
  for (const l of note.links || []) {
    noteMd += `- [[${l}]]\n`;
  }

  noteMd += "### Tags\n";
  for (const t of note.tags || []) {
    noteMd += `- ${t}\n`;
  }

  noteMd += "### Backlinks\n";
  for (const b of note.backlinks || []) {
    noteMd += `- [[${b}]]\n`;
  }

  noteMd += "### Directory Structure\n```\n";
  const contextPaths = [
    note.path,
    ...(note.folderSiblings || []).map((s) => {
      const dir =
        !note.parentPath || note.parentPath === "/"
          ? ""
          : `${note.parentPath}/`;
      return `${dir}${s}.md`;
    }),
  ];
  noteMd += renderDiscoveredStructure(contextPaths);
  noteMd += "\n```\n";

  if (note.content) {
    noteMd += "### Content\n```\n";
    noteMd += note.content.trim();
    noteMd += "\n```\n";
  } else if (note.structure) {
    noteMd += "\n### Structure\n```\n";
    noteMd += note.structure.trim();
    noteMd += "\n```\n";
  }
  return noteMd;
}

/**
 * Sets the active note in the agent's context.
 * 1. If no prompts in history, remove the old active note(s)
 * 2. If prompts in history, just deactivate the old active note(s)
 * 3. Add/set the new note to active
 */
export async function setActiveNote(
  app: App,
  state: AgentState,
  basename: string,
): Promise<AgentState> {
  const hasPrompts = state.history.some((entry) => entry.role === "user");
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
      current = await readNote(app, file, "text");
      discoveredStructure = Array.from(
        new Set([...discoveredStructure, file.path]),
      );
    }
  }

  if (current) {
    notesCopy.set(basename, { ...current, active: true });
  }

  return state
    .replaceNotes(notesCopy)
    .appendDiscoveredStructure(discoveredStructure);
}

/**
 * Adds a note to the agent's context by its basename.
 */
export async function addNote(
  app: App,
  state: AgentState,
  basename: string,
): Promise<AgentState> {
  if (state.notes.has(basename)) {
    return state;
  }

  const file = app.metadataCache.getFirstLinkpathDest(basename, "");
  if (!file) {
    return state;
  }

  const newNote = await readNote(app, file, "text");

  return state
    .appendNote(basename, newNote)
    .appendDiscoveredStructure([file.path]);
}

/**
 * Refreshes all notes in the agent's context.
 */
export async function refreshNotes(
  app: App,
  state: AgentState,
): Promise<AgentState> {
  const newNotes = new Map<string, Note>();
  const currentDiscoveredStructure = new Set(state.discoveredStructure);

  for (const [basename, note] of state.notes) {
    const file = app.vault.getAbstractFileByPath(note.path);
    if (file instanceof TFile) {
      const refreshedNote = await readNote(
        app,
        file,
        note.content ? "text" : "structure",
      );
      newNotes.set(basename, { ...refreshedNote, active: note.active });
    } else {
      // If file is gone, remove it from context
      currentDiscoveredStructure.delete(note.path);
    }
  }

  return new AgentState(
    state.history,
    newNotes,
    Array.from(currentDiscoveredStructure),
  );
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
        tree += `${"  ".repeat(indent) + (isFolder ? "- 📁 " : "- 📄 ") + key}\n`;
        buildTree(child, indent + 1);
      }
    }
  };

  buildTree(root);
  return tree.trim();
}

/**
 * Extracts Obsidian links from a string.
 */
export function extractLinks(text: string): string[] {
  if (!text.includes("[[")) {
    return [];
  }
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?]]/g;
  const linksFound: string[] = [];
  const matches = text.matchAll(linkRegex);
  for (const match of matches) {
    const basename = match[1]?.trim();
    if (basename) {
      linksFound.push(basename);
    }
  }
  return linksFound;
}
