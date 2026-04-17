import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import { renderNoteToMarkdown } from "../agent-render";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";

export class ReadNoteMetadataTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "read_note_metadata",
      description:
        "Retrieves note properties including file path, tags, outgoing links, and inbound backlinks. Use this for graph navigation and metadata discovery without reading full content.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "The path or title of the note to read metadata for (e.g., 'Project Alpha' or 'Work/Projects/Project Alpha').",
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
        ToolResult.createError(`Read note metadata: ${error}`, error),
      ];
    }

    const filename = file.basename;

    // If the note is already in context, this tool is a no-op.
    // (Keeping the old behavior: return an error-like result so the LLM learns
    // it shouldn't call this again.)

    const existingNote = state.notes.get(filename);
    if (existingNote) {
      this.logger.info(
        `Note [[${filename}]] already has metadata in context, skipping metadata read.`,
      );
      const skipMessage = `Note [[${filename}]] is already in the context, and its metadata (links, tags, etc.) is already available there. Reading note metadata again would be a no-op.`;
      return [
        state,
        ToolResult.createError(
          `Read note metadata: skipped for [[${filename}]] (already in context)`,
          skipMessage,
        ),
      ];
    }

    const newNote = await readNote(this.app, file, "metadata");

    // Preserve in-memory note state (active flag, suggestion state, etc.)
    // when re-reading the note from disk.
    const existingState = state.notes.get(filename)?.state;
    if (existingState) {
      newNote.state = existingState;
    }

    const newState = state
      .appendNote(filename, newNote)
      .appendDiscoveredStructure([file.path]);

    return [
      newState,
      ToolResult.createOkShort(
        `Read note metadata: [[${filename}]]`,
        renderNoteToMarkdown(newNote),
        `Successfully read metadata of note [[${filename}]] and added it to the context.`,
      ),
    ];
  }
}
