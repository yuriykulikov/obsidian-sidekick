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

    const defaultOffset = 0;
    const defaultLimit = 30;

    const offset = Number.isFinite(params.offset as number)
      ? Math.max(0, Math.floor(params.offset as number))
      : defaultOffset;
    const limit = Number.isFinite(params.limit as number)
      ? Math.max(1, Math.floor(params.limit as number))
      : defaultLimit;

    const allFiles = this.app.vault.getAllLoadedFiles();
    const matches = allFiles.filter(
      (file): file is TFile =>
        file instanceof TFile &&
        file.extension === "md" &&
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

    const total = matches.length;
    const page = matches.slice(offset, offset + limit);
    const shownStart = total === 0 ? 0 : Math.min(offset, total);
    const shownEndExclusive = Math.min(offset + limit, total);
    const omitted = total - shownEndExclusive;

    const newState = state.appendDiscoveredStructure(page.map((m) => m.path));

    let output = `Found ${total} notes for "${query}" (${scope}).\n`;
    output += `Showing ${shownStart}..${shownEndExclusive - 1} (${page.length} notes).\n`;
    if (omitted > 0) {
      output += `Note: ${omitted} more result(s) omitted. Call again with offset=${shownEndExclusive} limit=${limit}.\n`;
    }
    output += `\n### Notes\n`;
    output += `${page.map((m) => `- [[${m.path}]]`).join("\n")}\n\n`;

    return [
      newState,
      ToolResult.createOk(
        (() => {
          const isDefaultPaging =
            offset === defaultOffset && limit === defaultLimit;
          const pagingSuffix = !isDefaultPaging
            ? ` (offset=${offset}, limit=${limit})`
            : "";
          const omittedSuffix = omitted > 0 ? ` (${omitted} omitted)` : "";
          return `Search notes: found ${total} matches for "${query}"${pagingSuffix}${omittedSuffix}`;
        })(),
        output.trim(),
      ),
    ];
  }
}
