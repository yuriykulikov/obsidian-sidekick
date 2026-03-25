import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
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
        "Fetches a note's structure, including headings, links, and backlinks. Use this to quickly understand the organization of a note and navigate to related content without reading the full text.",
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
      this.logger.warn(`Note [[${path}]] not found.`);
      return [state, { error: `Note [[${path}]] not found.` }];
    }

    const filename = file.basename;

    // Check if the note is already in state with full content
    const existingNote = state.notes.get(filename);
    if (existingNote?.content) {
      this.logger.info(
        `Note [[${filename}]] already has content in context, skipping structure read.`,
      );
      return [
        state,
        {
          output: `Note [[${filename}]] already has full content in the context, which includes its structure. You don't need to read its structure separately.`,
          pretty: `Skipped reading structure of [[${filename}]] (already in context)`,
        },
      ];
    }

    const newNote = await readNote(this.app, file, "structure");

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    const output = `Successfully read structure of note [[${filename}]] and added it to the context.`;

    return [
      newState,
      {
        output: output,
        pretty: `Read structure of [[${filename}]]`,
      },
    ];
  }
}
