import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool, ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class GrepSearchTool implements Tool {
  constructor(
    private app: App,
    private logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "grep_search",
      description:
        "Searches for a specific text string within all notes in the vault. Returns a list of matches including the file path and surrounding lines of text for context. This is useful for finding specific information, mentions, or patterns across the entire vault.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          query: {
            type: Type.STRING,
            description: "The text string to search for.",
          },
          contextLines: {
            type: Type.NUMBER,
            description:
              "The number of lines of context to include before and after each match (default: 1).",
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
    const query = params.query as string;
    const contextLines = (params.contextLines as number) ?? 1;

    const markdownFiles = this.app.vault.getMarkdownFiles();
    const results: { path: string; matches: string[] }[] = [];

    for (const file of markdownFiles) {
      try {
        const content = await this.app.vault.cachedRead(file);
        const lines = content.split("\n");
        const matches: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line?.includes(query)) {
            const start = Math.max(0, i - contextLines);
            const end = Math.min(lines.length - 1, i + contextLines);
            const contextMatch = lines
              .slice(start, end + 1)
              .map((line, idx) => {
                const lineNum = start + idx + 1;
                const isMatch = lineNum === i + 1;
                return `${lineNum}: ${isMatch ? "**" : ""}${line}${isMatch ? "**" : ""}`;
              })
              .join("\n");
            matches.push(contextMatch);
          }
        }

        if (matches.length > 0) {
          results.push({ path: file.path, matches });
        }
      } catch (error) {
        this.logger.error(`Error reading file ${file.path}: ${error}`);
      }
    }

    if (results.length === 0) {
      return [
        state,
        {
          output: `No matches found for "${query}" in the vault.`,
          pretty: `Grep search for "${query}": no matches`,
        },
      ];
    }

    const matchingPaths = results.map((r) => r.path);
    const newState = state.appendDiscoveredStructure(matchingPaths);

    let output = `Found matches for "${query}" in ${results.length} notes:\n\n`;
    for (const res of results) {
      output += `### [[${res.path}]]\n`;
      for (const match of res.matches) {
        output += "```text\n";
        output += match;
        output += "\n```\n";
      }
      output += "\n";
    }

    return [
      newState,
      {
        output: output.trim(),
        pretty: `Grep search for "${query}": ${results.length} notes matched`,
      },
    ];
  }
}
