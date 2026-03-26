import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/notes";

export class ReadNoteLinksTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note_links",
      description:
        "Reads the links and backlinks of a note. Use this when you need to understand the relationships between this note and others in the vault.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "The path or title of the note to read links for (e.g., 'Project Alpha' or 'Work/Projects/Project Alpha').",
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
    const newNote = await readNote(this.app, file, "links");

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    const output = {
      filename: filename,
      path: file.path,
      links: newNote.links,
      backlinks: newNote.backlinks,
    };

    return [
      newState,
      {
        output: output,
        pretty: `Read links of [[${filename}]]`,
      },
    ];
  }
}
