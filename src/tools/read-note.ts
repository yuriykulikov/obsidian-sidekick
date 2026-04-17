import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import { renderNoteToMarkdown } from "../agent-render";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";

export class ReadNoteTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note",
      description:
        "Reads the full content of a note. Use this when you have a specific note name or path (e.g., from a link [[Note]] or a search result) and need to understand its details.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "The path or title of the note to read (e.g., 'Work/Projects/Project Alpha' or 'Project Alpha').",
          },
        },
        required: ["path"],
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const path = params.path as string;
    const file = this.app.metadataCache.getFirstLinkpathDest(path, "");
    if (!file) {
      const message = `Note [[${path}]] not found.`;
      this.logger.warn(message);
      return [state, ToolResult.createError(`Read note: ${message}`, message)];
    }

    const filename = file.basename;
    const newNote = await readNote(this.app, file, "text");

    // Preserve in-memory note state (active flag, suggestion state, etc.)
    // when re-reading the note from disk.
    newNote.state = state.notes.get(filename)?.state;

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    return [
      newState,
      ToolResult.createOkShort(
        `Read note: [[${filename}]]`,
        renderNoteToMarkdown(newNote),
        `Successfully read content of note [[${filename}]] and added it to the context.`,
      ),
    ];
  }
}
