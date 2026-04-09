import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

type SearchNotesScope = "path" | "basename";

export class SearchNotesTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "search_notes",
      description:
        "Searches for Markdown notes by name when you don't have a direct link. Returns a list of matching note paths. Do NOT use this if you already have a [[Link]] to the note you want to look up.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "The search query (part of the note name).",
          },
          scope: {
            type: Type.STRING,
            description:
              "Where to search: 'path' (default) searches the full note path; 'basename' searches only the file name without extension.",
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
    const scopeParam = params.scope;
    const scope: SearchNotesScope =
      scopeParam === "basename" || scopeParam === "path" ? scopeParam : "path";

    const allFiles = this.app.vault.getAllLoadedFiles();
    const matches = allFiles.filter(
      (file): file is TFile =>
        file instanceof TFile &&
        file.extension === "md" &&
        (scope === "path"
          ? file.path.toLowerCase().includes(query)
          : file.basename.toLowerCase().includes(query)),
    );

    if (matches.length === 0) {
      const message = `No notes found matching "${query}" (${scope}).`;
      return [
        state,
        ToolResult.createOk(`Search notes: no matches for "${query}"`, message),
      ];
    }

    const newState = state.appendDiscoveredStructure(
      matches.map((m) => m.path),
    );

    let output = `Found ${matches.length} notes for "${query}" (${scope}):\n\n`;
    output += `### Notes\n`;
    output += `${matches.map((m) => `- [[${m.path}]]`).join("\n")}\n\n`;

    return [
      newState,
      ToolResult.createOk(
        `Search notes: found ${matches.length} matches for "${query}"`,
        output.trim(),
      ),
    ];
  }
}
