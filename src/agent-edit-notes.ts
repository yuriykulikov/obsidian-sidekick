import type { App } from "obsidian";
import { TFile } from "obsidian";

import type { Note } from "./types";
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
