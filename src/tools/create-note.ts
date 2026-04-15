import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile, TFolder } from "obsidian";
import type { AgentState, Note, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";

export class CreateNoteTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "create-note",
      description: "Creates a new note in the vault.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "The name of the note (without .md extension).",
          },
          path: {
            type: Type.STRING,
            description:
              "The folder path where the note should be created (e.g., 'Notes/Drafts'). If omitted, it will be created in the root folder.",
          },
          content: {
            type: Type.STRING,
            description: "The text content of the note.",
          },
        },
        required: ["name", "content"],
      },
    };
  }

  private normalizePath(path: string): string {
    return path.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
  }

  async execute(
    prevState: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const name = params.name as string;
    const path = (params.path as string) || "";
    const content = params.content as string;

    const normalizedDir = this.normalizePath(path);
    const fullPath = normalizedDir
      ? `${normalizedDir}/${name}.md`
      : `${name}.md`;

    try {
      // Check if file already exists
      const existingFile = this.app.vault.getAbstractFileByPath(fullPath);
      if (existingFile) {
        return [
          prevState,
          ToolResult.createError(
            "Create note: failed",
            `File already exists at path: ${fullPath}`,
          ),
        ];
      }

      // Ensure directory exists
      if (normalizedDir !== "" && normalizedDir !== "/") {
        const folder = this.app.vault.getAbstractFileByPath(normalizedDir);
        if (!(folder instanceof TFolder)) {
          // Attempt to create folders if they don't exist
          await this.app.vault.createFolder(normalizedDir);
        }
      }

      const file = await this.app.vault.create(fullPath, content);
      if (!(file instanceof TFile) && (typeof TFile === "undefined" || !file)) {
        throw new Error("Failed to create file");
      }

      const note = await readNote(this.app, file, "text");
      const createdNote: Note = {
        ...note,
        state: {
          ...note.state,
          created: true,
        },
      };

      const newState = prevState.appendNote(createdNote.filename, createdNote);

      return [
        newState,
        ToolResult.createOk(
          `Created note [[${createdNote.filename}]]`,
          `Note created at: ${fullPath}`,
        ),
      ];
    } catch (error) {
      this.logger.error(`Error creating note: ${error}`);
      return [
        prevState,
        ToolResult.createError(
          "Create note: failed",
          `Error creating note: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ];
    }
  }
}
