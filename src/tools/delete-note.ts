import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Note, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class DeleteNoteTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "delete-note",
      description:
        "Marks notes for deletion. The notes are not immediately deleted from disk. The user can rollback the deletion from the UI.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          notes: {
            type: Type.ARRAY,
            description: "A list of note paths or titles to delete.",
            items: {
              type: Type.STRING,
            },
          },
        },
        required: ["notes"],
      },
    };
  }

  async execute(
    prevState: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const noteRefs = params.notes as string[];
    let modifiedState = prevState;
    const deletedNotes: string[] = [];
    const errors: string[] = [];

    for (const noteRef of noteRefs) {
      const note = this.resolveNote(modifiedState, noteRef);

      if (!note) {
        errors.push(
          `Note [[${noteRef}]] not found in current context. You can only delete notes that are already in the conversation.`,
        );
        continue;
      }

      if (note.state?.deleted) {
        deletedNotes.push(note.filename);
        continue;
      }

      const updatedNote: Note = {
        ...note,
        state: {
          ...note.state,
          deleted: true,
        },
      };

      modifiedState = modifiedState.appendNote(
        updatedNote.filename,
        updatedNote,
      );
      deletedNotes.push(updatedNote.filename);
    }

    if (errors.length > 0 && deletedNotes.length === 0) {
      const errorMsg = `## Errors\n\n${errors.join("\n")}`;
      return [
        prevState,
        ToolResult.createError("Delete note: failed to delete notes", errorMsg),
      ];
    } else {
      const summary = `Marked for deletion: ${deletedNotes.join(", ")}${errors.length > 0 ? " (with some errors)" : ""}`;
      let output = `The following notes have been marked for deletion: ${deletedNotes.map((n) => `[[${n}]]`).join(", ")}.`;
      if (errors.length > 0) {
        output += `\n\n## Errors\n\n${errors.join("\n")}`;
      }
      return [modifiedState, ToolResult.createOk(summary, output)];
    }
  }

  private resolveNote(state: AgentState, noteRef: string): Note | undefined {
    if (state.notes.has(noteRef)) {
      return state.notes.get(noteRef);
    }

    const file = this.app.metadataCache?.getFirstLinkpathDest(noteRef, "");
    if (file && state.notes.has(file.basename)) {
      return state.notes.get(file.basename);
    }

    return undefined;
  }
}
