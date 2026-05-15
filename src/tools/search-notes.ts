import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { Pagination } from "../utils/pagination";

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
          offset: {
            type: Type.NUMBER,
            description:
              "Paging: number of matches to skip before returning results (default: 0).",
          },
          limit: {
            type: Type.NUMBER,
            description:
              "Paging: maximum number of matches to return (default: 30).",
          },
          path_prefix: {
            type: Type.STRING,
            description:
              "Optional path prefix to narrow down the search to specific directories (e.g., 'Projects/').",
          },
          reason: {
            type: Type.STRING,
            description: "The reason why you are searching for these notes.",
          },
        },
        required: ["query", "reason"],
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
    const pathPrefix = params.path_prefix as string | undefined;

    const allFiles = this.app.vault.getAllLoadedFiles();
    const matches = allFiles.filter(
      (file): file is TFile =>
        file instanceof TFile &&
        file.extension === "md" &&
        (!pathPrefix || file.path.startsWith(pathPrefix)) &&
        (scope === "path"
          ? file.path.toLowerCase().includes(query)
          : file.basename.toLowerCase().includes(query)),
    );

    matches.sort((a, b) => a.path.localeCompare(b.path));

    if (matches.length === 0) {
      const message = `No notes found matching "${query}" (${scope}).`;
      return [
        state,
        ToolResult.createOk(`Search notes: no matches for "${query}"`, message),
      ];
    }

    const pagination = new Pagination(params, 30);
    const page = pagination.paginate(matches);
    const newState = state.appendDiscoveredStructure(
      page.items.map((m) => m.path),
    );

    let output = `Found ${page.total} notes for "${query}" (${scope}).\n`;
    output += page.header();
    output += `\n### Notes\n`;
    output += `${page.items.map((m) => `- [[${m.path}]]`).join("\n")}\n\n`;

    return [
      newState,
      ToolResult.createOk(
        `Search notes: found ${page.total} matches for "${query}"${page.suffix()}`,
        output.trim(),
      ),
    ];
  }
}
