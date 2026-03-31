import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
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
            description: "The text string or regex pattern to search for.",
          },
          regex: {
            type: Type.BOOLEAN,
            description:
              "Whether to treat the query as a regular expression (default: false).",
          },
          regexExplanation: {
            type: Type.STRING,
            description:
              "If using a regular expression, provide a brief explanation of what it matches. This will be included in the tool result summary.",
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
    const regex = (params.regex as boolean) ?? false;
    const regexExplanation = params.regexExplanation as string | undefined;
    const contextLines = (params.contextLines as number) ?? 1;

    let searchFn: (text: string) => boolean;
    if (regex) {
      try {
        const re = new RegExp(query);
        searchFn = (text: string) => re.test(text);
      } catch (error) {
        const message = `Invalid regular expression "${regex}": ${error instanceof Error ? error.message : String(error)}`;
        return [
          state,
          ToolResult.createError(
            `Grep search: invalid regex${regexExplanation ? ` (${regexExplanation})` : ""}`,
            message,
          ),
        ];
      }
    } else {
      searchFn = (text: string) => text.includes(query);
    }

    const markdownFiles = this.app.vault.getMarkdownFiles();
    const results: { path: string; matches: string[] }[] = [];

    for (const file of markdownFiles) {
      try {
        const content = await this.app.vault.cachedRead(file);
        const lines = content.split("\n");
        const matches: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line && searchFn(line)) {
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
      const message = `No matches found for "${query}" in the vault.`;
      return [
        state,
        ToolResult.createOk(
          `Grep search: no matches for "${query}"${regexExplanation ? ` (${regexExplanation})` : ""}`,
          message,
        ),
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
      ToolResult.createOk(
        `Grep search: found matches for "${query}" in ${results.length} notes${
          regexExplanation ? ` (${regexExplanation})` : ""
        }`,
        output.trim(),
      ),
    ];
  }
}
