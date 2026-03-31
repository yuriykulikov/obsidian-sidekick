import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/notes";

export class ReadNoteStructureTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note_structure",
      description:
        "Fetches a note's structure, including headings, links, and backlinks. Use this when you have a specific note name or path (e.g., from a link [[Note]] or a search result) to quickly understand its organization and navigate to related content without reading the full text.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "The path or title of the note to fetch (e.g., 'Work/Projects/Project Alpha' or 'Project Alpha').",
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
      return [
        state,
        ToolResult.createError(`Read note structure: ${message}`, message),
      ];
    }

    const filename = file.basename;

    // Check if the note is already in state with full content
    const existingNote = state.notes.get(filename);
    if (existingNote?.content) {
      this.logger.info(
        `Note [[${filename}]] already has content in context, skipping structure read.`,
      );
      const skipMessage = `Note [[${filename}]] already has full content in the context, which includes its structure. You don't need to read its structure separately.`;
      return [
        state,
        ToolResult.createError(
          `Read note structure: skipped for [[${filename}]] (already in context)`,
          skipMessage,
        ),
      ];
    }

    const newNote = await readNote(this.app, file, "structure");

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    return [
      newState,
      ToolResult.createOkShort(
        `Read note structure: [[${filename}]]`,
        newNote.structure || "Empty note",
        `Successfully read structure of note [[${filename}]] and added it to the context.`,
      ),
    ];
  }
}
