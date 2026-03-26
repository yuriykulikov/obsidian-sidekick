import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/notes";

export class ReadNoteTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note",
      description:
        "Reads the full content of a note. Use this when you need to understand the details of a note or quote from it.",
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
      return [state, { error: message, summary: `Read note: ${message}` }];
    }

    const filename = file.basename;
    const newNote = await readNote(this.app, file, "text");

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    const output = `Successfully read content of note [[${filename}]] and added it to the context.`;

    return [
      newState,
      {
        output: output,
        summary: `Read note: [[${filename}]]`,
      },
    ];
  }
}
