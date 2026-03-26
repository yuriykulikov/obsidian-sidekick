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
        "Reads the links and backlinks of a note. Use this when you need to understand the relationships between this note and others in the vault. Once you have these links, use 'read_note', 'read_note_structure' or '' for direct navigation.",
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
      const error = `Note [[${path}]] not found.`;
      this.logger.warn(error);
      return [
        state,
        {
          error,
          summary: `Read note links: ${error}`,
        },
      ];
    }

    const filename = file.basename;
    const newNote = await readNote(this.app, file, "links");

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    let output = `## Links for [[${filename}]]\n\n`;
    output += `### Links\n${newNote.links.map((l) => `- [[${l}]]`).join("\n") || "_No links found._"}\n\n`;
    output += `### Backlinks\n${newNote.backlinks.map((b) => `- [[${b}]]`).join("\n") || "_No backlinks found._"}`;

    return [
      newState,
      {
        output: output,
        summary: `Read note links: [[${filename}]]`,
        verbose: `Read ${newNote.links.length} links and ${newNote.backlinks.length} backlinks of [[${filename}]]\n${output}`,
      },
    ];
  }
}
