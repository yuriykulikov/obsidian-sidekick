import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class SearchTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "search",
      description:
        "Searches for notes and folders by name. Returns a list of matching paths. Use this to find the location of notes or folders in the vault.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "The search query (part of the note or folder name).",
          },
        },
        required: ["query"],
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const query = (params.query as string).toLowerCase();

    const allFiles = this.app.vault.getAllLoadedFiles();
    const matches = allFiles.filter((file) => {
      if (file instanceof TFile && file.extension !== "md") {
        return false;
      }
      const nameToSearch = file instanceof TFile ? file.basename : file.name;
      return nameToSearch.toLowerCase().includes(query);
    });

    if (matches.length === 0) {
      return [
        state,
        {
          output: `No notes or folders found matching "${query}".`,
          pretty: `Search for "${query}": no matches`,
        },
      ];
    }

    const newState = state.appendDiscoveredStructure(
      matches.map((m) => m.path),
    );

    const notes = matches.filter((m) => m instanceof TFile);
    const folders = matches.filter((m) => !(m instanceof TFile));

    let output = `Found ${matches.length} matches for "${query}":\n\n`;

    if (notes.length > 0) {
      output += `### Notes\n`;
      output += `${notes.map((m) => `- [[${m.path}]]`).join("\n")}\n\n`;
    }

    if (folders.length > 0) {
      output += `### Folders\n`;
      output += `${folders.map((m) => `- \`${m.path}/\``).join("\n")}\n\n`;
    }

    return [
      newState,
      {
        output: output.trim(),
        pretty: `Search for "${query}": ${matches.length} matches`,
      },
    ];
  }
}
