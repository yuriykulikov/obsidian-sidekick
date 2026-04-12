import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

/**
 * Lists "unlinked" notes: markdown notes that have *no backlinks* (no other note links to them).
 *
 * Notes:
 * - This definition is strictly about inbound links. A note can have outgoing links and still appear here.
 * - Uses `metadataCache.resolvedLinks` (link graph) rather than scanning file contents.
 */
export class ListUnlinkedNotesTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "list_unlinked_notes",
      description:
        "Lists markdown notes that have no backlinks (no inbound links from other notes). This is a rare consistency tool to find orphan notes to connect.",
      parameters: {
        type: Type.OBJECT,
        properties: {},
      },
    };
  }

  async execute(
    state: AgentState,
    _params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const inboundCounts = this.getInboundLinkCounts();

    const allFiles = this.app.vault.getAllLoadedFiles();
    const mdFiles = allFiles.filter(
      (f): f is TFile => f instanceof TFile && f.extension === "md",
    );

    const matches = mdFiles
      .filter((f) => {
        if (this.hasAnyTags(f.path)) return false;
        return (inboundCounts.get(f.path) ?? 0) === 0;
      })
      .sort((a, b) => a.path.localeCompare(b.path));

    const total = matches.length;

    if (total === 0) {
      return [
        state,
        ToolResult.createOk(
          "List unlinked notes: none found",
          "No unlinked notes found (notes with zero backlinks).",
        ),
      ];
    }

    let output = `Found ${total} unlinked note(s) (zero backlinks).\n`;
    output += "\n### Notes\n";
    output += `${matches.map((f) => `- [[${f.path}]]`).join("\n")}\n`;

    const newState = state.appendDiscoveredStructure(
      matches.map((f) => f.path),
    );

    const shortOutput =
      matches.length === 1
        ? `Found 1 unlinked note. Added it to discovered vault structure in context.`
        : `Found ${total} unlinked notes. Added them to discovered vault structure in context.`;

    return [
      newState,
      ToolResult.createOkShort(
        `List unlinked notes: found ${total}`,
        output.trim(),
        shortOutput,
      ),
    ];
  }

  private getInboundLinkCounts(): Map<string, number> {
    const counts = new Map<string, number>();

    // Shape: { [sourcePath: string]: { [targetPath: string]: number } }
    // In Obsidian, resolvedLinks includes both links and embeds. That is usually desirable for "backlinks".
    const resolvedLinks =
      (this.app.metadataCache as unknown as { resolvedLinks?: unknown })
        .resolvedLinks ?? {};

    if (typeof resolvedLinks !== "object" || resolvedLinks === null) {
      return counts;
    }

    for (const targets of Object.values(
      resolvedLinks as Record<string, Record<string, number>>,
    )) {
      if (typeof targets !== "object" || targets === null) continue;
      for (const targetPath of Object.keys(targets)) {
        counts.set(targetPath, (counts.get(targetPath) ?? 0) + 1);
      }
    }

    return counts;
  }

  /** True if the note currently has any tags (frontmatter or inline). */
  private hasAnyTags(path: string): boolean {
    const fileCache = this.app.metadataCache.getCache(path);

    const frontmatterTags = fileCache?.frontmatter?.tags;
    if (typeof frontmatterTags === "string" && frontmatterTags.length > 0) {
      return true;
    }
    if (Array.isArray(frontmatterTags) && frontmatterTags.length > 0) {
      return true;
    }

    const tags = fileCache?.tags;
    return Array.isArray(tags) && tags.length > 0;
  }
}
