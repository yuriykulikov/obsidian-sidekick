import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";

export class ReadNoteLinksTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note_links",
      description:
        "Reads the links and backlinks of a note. Use this when you need to understand the relationships between this note and others in the vault. Once you have these links, use 'read_note', 'read_note_structure' or 'read_note_links' for direct navigation.",
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
        ToolResult.createError(`Read note links: ${error}`, error),
      ];
    }

    const filename = file.basename;

    // If the note is already in context, this tool is a no-op.
    // (Keeping the old behavior: return an error-like result so the LLM learns
    // it shouldn't call this again.)

    const existingNote = state.notes.get(filename);
    if (existingNote) {
      this.logger.info(
        `Note [[${filename}]] already has links in context, skipping links read.`,
      );
      const skipMessage = `Note [[${filename}]] is already in the context, and its links and backlinks are already available there. Reading note links again would be a no-op.`;
      return [
        state,
        ToolResult.createError(
          `Read note links: skipped for [[${filename}]] (already in context)`,
          skipMessage,
        ),
      ];
    }

    const newNote = await readNote(this.app, file, "links");

    // Preserve in-memory note state (active flag, suggestion state, etc.)
    // when re-reading the note from disk.
    const existingState = state.notes.get(filename)?.state;
    if (existingState) {
      newNote.state = existingState;
    }

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    let output = `## Links for [[${filename}]]\n\n`;
    output += `### Links\n${newNote.links.map((l) => `- [[${l}]]`).join("\n") || "_No links found._"}\n\n`;
    output += `### Backlinks\n${newNote.backlinks.map((b) => `- [[${b}]]`).join("\n") || "_No backlinks found._"}`;

    return [
      newState,
      ToolResult.createOkShort(
        `Read note links: [[${filename}]]`,
        `Added ${newNote.links.length} links and ${newNote.backlinks.length} backlinks from [[${filename}]] to the context.\n${output}`,
        output,
      ),
    ];
  }
}
