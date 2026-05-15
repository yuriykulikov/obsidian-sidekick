import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";
import { Pagination } from "../utils/pagination";

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
          offset: {
            type: Type.NUMBER,
            description:
              "Paging: number of result files to skip before returning results (default: 0).",
          },
          limit: {
            type: Type.NUMBER,
            description:
              "Paging: maximum number of result files to return (default: 30).",
          },
          path_prefix: {
            type: Type.STRING,
            description:
              "Optional path prefix to narrow down the search to specific directories (e.g., 'Projects/').",
          },
          reason: {
            type: Type.STRING,
            description: "The reason why you are performing this grep search.",
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
    const query = params.query as string;
    const regex = (params.regex as boolean) ?? false;
    const regexExplanation = params.regexExplanation as string | undefined;
    const contextLines = (params.contextLines as number) ?? 1;
    const pathPrefix = params.path_prefix as string | undefined;

    const pagination = new Pagination(params, 30);

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

    const markdownFiles = this.app.vault.getMarkdownFiles().filter((file) => {
      if (pathPrefix && !file.path.startsWith(pathPrefix)) {
        return false;
      }
      return true;
    });
    const results: { path: string; matches: string[] }[] = [];

    const searchFile = async (file: (typeof markdownFiles)[number]) => {
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
              .map((l, idx) => {
                const lineNum = start + idx + 1;
                const isMatch = lineNum === i + 1;
                return `${lineNum}: ${isMatch ? "**" : ""}${l}${isMatch ? "**" : ""}`;
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
    };

    // Process files in parallel chunks to avoid blocking on large vaults
    const CHUNK_SIZE = 50;
    for (let i = 0; i < markdownFiles.length; i += CHUNK_SIZE) {
      await Promise.all(markdownFiles.slice(i, i + CHUNK_SIZE).map(searchFile));
    }

    results.sort((a, b) => a.path.localeCompare(b.path));

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

    const page = pagination.paginate(results);
    const newState = state;

    let output = `Found matches for "${query}" in ${page.total} notes.\n`;
    output += page.header();
    output += "\n";

    for (const res of page.items) {
      output += `### [[${res.path}]]\n`;
      for (const match of res.matches) {
        output += "```text\n";
        output += match;
        output += "\n```\n";
      }
      output += "\n";
    }

    const explanationSuffix = regexExplanation ? ` (${regexExplanation})` : "";
    return [
      newState,
      ToolResult.createOk(
        `Grep search: found matches for "${query}" in ${page.total} notes${explanationSuffix}${page.suffix()}`,
        output.trim(),
      ),
    ];
  }
}
