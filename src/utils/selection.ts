import type { App, TFile } from "obsidian";
import type { Logger } from "./logger";

export interface CurrentSelection {
  file: TFile;
  selection: string;
}

/**
 * Attempts to read the current editor selection from the most recent leaf.
 *
 * Notes:
 * - Only works reliably in source mode.
 * - In preview mode selection is not accessible consistently, so this returns null.
 */
export function getCurrentSelectionFromMostRecentLeaf(
  _logger: Logger,
  app: App,
): CurrentSelection | null {
  const mostRecentLeaf = app.workspace.getMostRecentLeaf();
  if (!mostRecentLeaf) return null;

  const view = mostRecentLeaf.view;
  if (!view) return null;

  const file = (view as unknown as { file?: TFile }).file;
  if (!file) return null;

  const viewMode = (view as unknown as { getMode?: () => string }).getMode?.();
  if (viewMode !== "source") {
    return null;
  }

  const editor = (
    view as unknown as { editor?: { getSelection?: () => string } }
  ).editor;

  const selection = editor?.getSelection?.()?.trim();

  if (!selection) return null;

  return { file, selection };
}
