import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, getAllTags, type TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class SearchByTagTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "search_by_tag",
      description:
        "Searches for notes that have a specific tag. Returns a list of matching paths.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          tag: {
            type: Type.STRING,
            description: "The tag to search for (e.g., '#work' or 'work').",
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
        required: ["tag"],
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    let tag = params.tag as string;
    if (!tag.startsWith("#")) {
      tag = `#${tag}`;
    }

    const defaultOffset = 0;
    const defaultLimit = 30;

    const offset = Number.isFinite(params.offset as number)
      ? Math.max(0, Math.floor(params.offset as number))
      : defaultOffset;
    const limit = Number.isFinite(params.limit as number)
      ? Math.max(1, Math.floor(params.limit as number))
      : defaultLimit;

    const matches: TFile[] = [];
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache) {
        const tags = getAllTags(cache);
        if (tags?.some((t) => t.toLowerCase() === tag.toLowerCase())) {
          matches.push(file);
        }
      }
    }

    matches.sort((a, b) => a.path.localeCompare(b.path));

    if (matches.length === 0) {
      const message = `No notes found with tag "${tag}".`;
      return [
        state,
        ToolResult.createOk(`Search by tag: no matches for "${tag}"`, message),
      ];
    }

    const total = matches.length;
    const page = matches.slice(offset, offset + limit);
    const shownStart = Math.min(offset, total);
    const shownEndExclusive = Math.min(offset + limit, total);
    const omitted = total - shownEndExclusive;

    const newState = state.appendDiscoveredStructure(page.map((m) => m.path));

    let output = `Found ${total} notes with tag "${tag}".\n`;
    output += `Showing ${shownStart}..${shownEndExclusive - 1} (${page.length} notes).\n`;
    if (omitted > 0) {
      output += `Note: ${omitted} more result(s) omitted. Call again with offset=${shownEndExclusive} limit=${limit}.\n`;
    }
    output += "\n";
    output += `${page.map((m) => `- [[${m.path}]]`).join("\n")}\n`;

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
          return `Search by tag: found ${total} matches for "${tag}"${pagingSuffix}${omittedSuffix}`;
        })(),
        output.trim(),
      ),
    ];
  }
}
