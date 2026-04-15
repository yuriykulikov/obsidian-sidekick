import type { App } from "obsidian";
import { TFile } from "obsidian";

import type { AgentState, Note } from "./types";
import type { Logger } from "./utils/logger";

/**
 * Persist any notes that have pending suggestions (`hasSuggestions`) to disk.
 *
 * This keeping-the-vault-in-sync step lives in the agent layer (not the UI)
 * so it can be reused by other frontends and keeps file IO centralized.
 */
export async function persistSuggestedEdits(
  app: App,
  logger: Logger,
  notes: ReadonlyMap<string, Note>,
): Promise<void> {
  for (const [, note] of notes) {
    if (!note.state?.hasSuggestions) continue;
    await writeSuggestedContentToDisk(app, logger, note);
  }
}

/**
 * Roll back any in-session suggested edits, restoring notes to their original content.
 * Clears suggestion metadata and persists the reverted content to disk.
 */
export async function rollbackSuggestedEdits(
  app: App,
  logger: Logger,
  state: AgentState,
): Promise<AgentState> {
  const notesToRollback: Note[] = [];
  const notesToDelete: Note[] = [];
  const updatedNotes = new Map<string, Note>(state.notes);

  for (const [basename, note] of state.notes) {
    if (note.state?.created) {
      notesToDelete.push(note);
      updatedNotes.delete(basename);
      continue;
    }

    if (!note.state?.hasSuggestions) continue;
    const originalContent = note.state.originalContent;
    if (originalContent === undefined || originalContent === null) {
      continue;
    }

    const rolledBack: Note = {
      ...note,
      content: originalContent,
      state: {
        ...note.state,
        originalContent: null,
        hasSuggestions: false,
      },
    };
    updatedNotes.set(basename, rolledBack);
    notesToRollback.push(rolledBack);
  }

  if (notesToRollback.length === 0 && notesToDelete.length === 0) {
    return state;
  }

  // Update state first so UI reflects rollback even if disk write fails.
  const nextState = state.replaceNotes(updatedNotes).appendHistoryEntry({
    type: "notes_rollback",
    role: "user",
    notes: [
      ...notesToRollback.map((n) => n.filename),
      ...notesToDelete.map((n) => n.filename),
    ],
  });

  for (const note of notesToRollback) {
    await writeSuggestedContentToDisk(app, logger, note);
  }

  for (const note of notesToDelete) {
    const abstractFile = app.vault.getAbstractFileByPath(note.path);
    if (abstractFile instanceof TFile) {
      try {
        await app.vault.delete(abstractFile);
        logger.info(`Deleted note ${note.path} due to rollback`);
      } catch (error) {
        logger.error(
          `Failed to delete note ${note.path}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  return nextState;
}

async function writeSuggestedContentToDisk(
  app: App,
  logger: Logger,
  note: Note,
): Promise<void> {
  const abstractFile = app.vault.getAbstractFileByPath(note.path);
  if (!(abstractFile instanceof TFile)) {
    logger.warn(`Cannot write suggestions for ${note.filename}: ${note.path}`);
    return;
  }

  try {
    await app.vault.modify(abstractFile, note.content || "");
    logger.info(`Wrote suggestions to ${note.path}`);
  } catch (error) {
    logger.error(
      `Failed to write suggestions for ${note.filename} (${note.path}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
