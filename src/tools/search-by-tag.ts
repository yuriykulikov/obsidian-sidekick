import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, getAllTags, type TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { Pagination } from "../utils/pagination";

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
          reason: {
            type: Type.STRING,
            description: "The reason why you are searching by this tag.",
          },
        },
        required: ["tag", "reason"],
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

    const pagination = new Pagination(params, 30);
    const page = pagination.paginate(matches);
    const newState = state.appendDiscoveredStructure(
      page.items.map((m) => m.path),
    );

    let output = `Found ${page.total} notes with tag "${tag}".\n`;
    output += page.header();
    output += "\n";
    output += `${page.items.map((m) => `- [[${m.path}]]`).join("\n")}\n`;

    return [
      newState,
      ToolResult.createOk(
        `Search by tag: found ${page.total} matches for "${tag}"${page.suffix()}`,
        output.trim(),
      ),
    ];
  }
}
