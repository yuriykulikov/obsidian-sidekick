import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, getAllTags, type TFile } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
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

    if (matches.length === 0) {
      return [
        state,
        {
          output: `No notes found with tag "${tag}".`,
          summary: `Search by tag: no matches for "${tag}"`,
        },
      ];
    }

    const newState = state.appendDiscoveredStructure(
      matches.map((m) => m.path),
    );

    const output = `Found ${matches.length} notes with tag "${tag}":\n\n${matches
      .map((m) => `- [[${m.path}]]`)
      .join("\n")}\n`;

    return [
      newState,
      {
        output: output.trim(),
        summary: `Search by tag: found ${matches.length} matches for "${tag}"`,
        verbose: output.trim(),
      },
    ];
  }
}
