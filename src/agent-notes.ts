import { type App, TFile } from "obsidian";
import { AgentState, type Note } from "./types";
import { readNote } from "./utils/read-note";

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
    if (note.state?.active && name !== basename) {
      if (hasPrompts) {
        notesCopy.set(name, {
          ...note,
          state: {
            ...note.state,
            active: false,
          },
        });
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
    notesCopy.set(basename, {
      ...current,
      state: {
        ...current.state,
        active: true,
      },
    });
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
        note.content ? "text" : note.structure ? "structure" : "metadata",
      );
      newNotes.set(basename, {
        ...refreshedNote,
        // keep the state
        state: note.state,
      });
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
