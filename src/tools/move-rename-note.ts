import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";

export class MoveRenameNoteTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "move_rename_note",
      description:
        "Renames or moves a note in the vault. This also updates all internal links to this note. The change can be rolled back from the UI.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          oldPath: {
            type: Type.STRING,
            description:
              "The current path of the note (e.g., 'OldFolder/MyNote.md').",
          },
          newPath: {
            type: Type.STRING,
            description:
              "The new path for the note (e.g., 'NewFolder/RenamedNote.md').",
          },
        },
        required: ["oldPath", "newPath"],
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const oldPath = params.oldPath as string;
    const newPath = params.newPath as string;

    const file = this.app.vault.getAbstractFileByPath(oldPath);
    if (!(file instanceof TFile)) {
      return [
        state,
        ToolResult.createError(
          "Move/Rename note: failed",
          `Note at path '${oldPath}' not found or is not a file.`,
        ),
      ];
    }

    try {
      const oldFilename = file.basename;
      const oldFullPath = file.path;

      // Check if destination already exists
      const existing = this.app.vault.getAbstractFileByPath(newPath);
      if (existing) {
        return [
          state,
          ToolResult.createError(
            "Move/Rename note: failed",
            `A file already exists at the destination path: '${newPath}'.`,
          ),
        ];
      }

      // Rename/Move the file
      await this.app.fileManager.renameFile(file, newPath);

      // Now update the agent state.
      // 1. Remove the old note from state.notes
      let newState = state.removeNote(oldFilename);

      // 2. Read the note at the new path to get refreshed content/metadata
      const updatedNote = await readNote(this.app, file, "text");

      // 3. Preserve and update state for rollback and highlight
      const prevState = state.notes.get(oldFilename)?.state;
      updatedNote.state = {
        ...prevState,
        originalFilename: prevState?.originalFilename || oldFilename,
        originalPath: prevState?.originalPath || oldFullPath,
      };

      // 4. Add the new note to context
      newState = newState.appendNote(updatedNote.filename, updatedNote);

      // 5. Update discovered structure: remove old, add new
      const newDiscovered = state.discoveredStructure
        .filter((p) => p !== oldFullPath)
        .concat(newPath);
      newState = newState.appendDiscoveredStructure(newDiscovered);

      const summary = `Renamed [[${oldFilename}]] to [[${updatedNote.filename}]]`;
      const output = `Successfully moved and renamed note from '${oldPath}' to '${newPath}'. All links to this note have been updated.`;

      return [newState, ToolResult.createOk(summary, output)];
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to move/rename note: ${errorMsg}`);
      return [
        state,
        ToolResult.createError(
          "Move/Rename note: failed",
          `An error occurred while renaming the note: ${errorMsg}`,
        ),
      ];
    }
  }
}
