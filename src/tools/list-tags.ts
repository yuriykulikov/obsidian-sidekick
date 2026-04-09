import { type FunctionDeclaration, Type } from "@google/genai";
import type { App } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class ListTagsTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "list_tags",
      description:
        "Lists all unique tags used across the vault (from Obsidian metadata cache). Useful for discovery and for choosing tags for other operations.",
      parameters: {
        type: Type.OBJECT,
        properties: {},
        required: [],
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    void params;

    // Obsidian API exposes the canonical known-tag index here.
    const getTagsFn = (
      this.app.metadataCache as unknown as {
        getTags?: () => Record<string, number>;
      }
    ).getTags;

    if (typeof getTagsFn !== "function") {
      return [
        state,
        ToolResult.createError(
          "List tags: metadata cache does not expose getTags()",
          "Your Obsidian version does not expose metadataCache.getTags(), so Sidekick cannot list tags.",
        ),
      ];
    }

    const tagsRecord = getTagsFn.call(this.app.metadataCache);
    const tags = Object.keys(tagsRecord).sort((a, b) => a.localeCompare(b));

    if (tags.length === 0) {
      return [
        state,
        ToolResult.createOk(
          "List tags: no tags found",
          "No tags found in the vault.",
        ),
      ];
    }

    const output = `Found ${tags.length} tag(s).\n\n### Tags\n${tags
      .map((t) => `- ${t}`)
      .join("\n")}`;

    return [
      state,
      ToolResult.createOk(
        `List tags: found ${tags.length} tag(s)`,
        output.trim(),
      ),
    ];
  }
}
