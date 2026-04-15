import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Note, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export interface Suggestion {
  note: string;
  textToReplace?: string;
  replacement: string;
}

export class EditNoteTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "edit-note",
      description:
        "Suggests changes to notes currently in the conversation context. Suggestions update the note content (written to disk). The user can rollback suggested edits from the UI.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          suggestions: {
            type: Type.ARRAY,
            description: "A list of suggestion objects.",
            items: {
              type: Type.OBJECT,
              properties: {
                note: {
                  type: Type.STRING,
                  description: "Identifies the target note (path or title).",
                },
                textToReplace: {
                  type: Type.STRING,
                  description:
                    "The exact text in the note to be replaced. If omitted, the replacement text will be appended to the end of the note.",
                },
                replacement: {
                  type: Type.STRING,
                  description: "The suggested new text.",
                },
              },
              required: ["note", "replacement"],
            },
          },
        },
        required: ["suggestions"],
      },
    };
  }

  async execute(
    prevState: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const suggestions = params.suggestions as Suggestion[];
    let modifiedState = prevState;
    const errors: string[] = [];
    const appliedEditsByNote = new Map<string, Suggestion[]>();

    for (const suggestion of suggestions) {
      const note = this.resolveNote(modifiedState, suggestion.note);

      if (!note) {
        errors.push(
          `Note [[${suggestion.note}]] not found in current context. You can only edit notes that are already in the conversation.`,
        );
        continue;
      }

      const content = note.content || "";

      if (
        suggestion.textToReplace &&
        !content.includes(suggestion.textToReplace)
      ) {
        errors.push(
          `Text to replace not found in note [[${note.filename}]]. Make sure you provided the exact text, including whitespace and formatting.`,
        );
      } else {
        const newContent = suggestion.textToReplace
          ? content.replace(suggestion.textToReplace, suggestion.replacement)
          : `${content}${content.endsWith("\n") || content === "" ? "" : "\n"}${suggestion.replacement}`;

        const updatedNote: Note = {
          ...note,
          content: newContent,
          state: {
            ...note.state,
            hasSuggestions: true,
            originalContent:
              note.state?.hasSuggestions ||
              note.state?.originalContent !== undefined
                ? note.state.originalContent
                : note.content,
          },
        };

        modifiedState = modifiedState.appendNote(
          updatedNote.filename,
          updatedNote,
        );
        const noteEdits = appliedEditsByNote.get(updatedNote.filename) ?? [];
        noteEdits.push(suggestion);
        appliedEditsByNote.set(updatedNote.filename, noteEdits);
      }
    }

    if (errors.length > 0) {
      const errorMsg = `## Errors\n\n${errors.join("\n")}`;
      return [
        prevState,
        ToolResult.createError(
          "Suggest edit: failed to apply suggestions",
          errorMsg,
        ),
      ];
    } else {
      const formattedResult = this.formatAppliedSuggestions(appliedEditsByNote);

      const editedNoteNames = Array.from(appliedEditsByNote.keys());
      const summary = `Edited ${this.pluralize(editedNoteNames.length, "note")}: ${editedNoteNames.join(", ")}`;

      return [modifiedState, ToolResult.createOk(summary, formattedResult)];
    }
  }

  private pluralize(count: number, singular: string): string {
    return count === 1 ? singular : `${singular}s`;
  }

  private formatAppliedSuggestions(
    appliedEditsByNote: ReadonlyMap<string, Suggestion[]>,
  ): string {
    const lines: string[] = [];

    for (const [filename, noteEdits] of appliedEditsByNote) {
      lines.push(`# Note [[${filename}]]`);
      lines.push(
        `${noteEdits.length} ${this.pluralize(noteEdits.length, "suggestion")}:`,
      );

      for (const edit of noteEdits) {
        if (edit.textToReplace) {
          const removedLines = this.toDiffLines(edit.textToReplace);
          for (const l of removedLines) lines.push(`-${l}`);
          lines.push("");
        }

        const addedLines = this.toDiffLines(edit.replacement);
        for (const l of addedLines) lines.push(`+${l}`);
        lines.push("");
      }

      lines.push("");
    }

    return lines.join("\n").trim();
  }

  private toDiffLines(text: string): string[] {
    // Normalize CRLF and avoid emitting an extra empty diff line when the input
    // ends with a newline.
    const normalized = text.replace(/\r\n/g, "\n");
    const withoutTrailingNewline = normalized.endsWith("\n")
      ? normalized.slice(0, -1)
      : normalized;

    // Preserve internal empty lines (they become '-' / '+' lines with no text).
    return withoutTrailingNewline.split("\n");
  }

  resolveNote(state: AgentState, noteRef: string): Note | undefined {
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
