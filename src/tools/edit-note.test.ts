import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { AgentState, type Note } from "../types";
import type { Logger } from "../utils/logger";
import { EditNoteTool } from "./edit-note";

function buildState(note: Note): AgentState {
  return new AgentState([], new Map([[note.filename, note]]));
}

function buildApp(notePath: string, basename: string): App {
  return {
    metadataCache: {
      getFirstLinkpathDest(path: string) {
        if (path === notePath || path === basename) {
          return { basename };
        }
        return null;
      },
    },
  } as unknown as App;
}

describe("SuggestEditTool", () => {
  it("accepts note path with .md extension", async () => {
    const note: Note = {
      filename: "Sidekick suggestions test",
      path: "Productivity/Sidekick suggestions test.md",
      content: "old text",
      links: [],
      backlinks: [],
      tags: [],
    };

    const tool = new EditNoteTool(
      buildApp("Productivity/Sidekick suggestions test.md", note.filename),
      {} as Logger,
    );
    const [newState, result] = await tool.execute(buildState(note), {
      suggestions: [
        {
          note: "Productivity/Sidekick suggestions test.md",
          textToReplace: "old text",
          replacement: "new text",
        },
      ],
    });

    const updated = newState.notes.get("Sidekick suggestions test");
    expect(updated?.content).toBe("new text");
    expect(updated?.hasSuggestions).toBe(true);
    expect(result.summary).toBe("Suggest edit: applied suggestions");
    expect(result.llmOutputString()).toContain(
      "# Note [[Sidekick suggestions test]]",
    );
    expect(result.llmOutputString()).toContain("1 suggestion:");
    expect(result.llmOutputString()).toContain("-old text");
    expect(result.llmOutputString()).toContain("+new text");
  });

  it("accepts note title without path", async () => {
    const note: Note = {
      filename: "Sidekick suggestions test",
      path: "Productivity/Sidekick suggestions test.md",
      content: "old text",
      links: [],
      backlinks: [],
      tags: [],
    };

    const tool = new EditNoteTool(
      buildApp("Productivity/Sidekick suggestions test.md", note.filename),
      {} as Logger,
    );
    const [newState] = await tool.execute(buildState(note), {
      suggestions: [
        {
          note: "Sidekick suggestions test",
          textToReplace: "old text",
          replacement: "new text",
        },
      ],
    });

    expect(newState.notes.get("Sidekick suggestions test")?.content).toBe(
      "new text",
    );
  });

  it("includes errors in llm output", async () => {
    const note: Note = {
      filename: "Sidekick suggestions test",
      path: "Productivity/Sidekick suggestions test.md",
      content: "old text",
      links: [],
      backlinks: [],
      tags: [],
    };

    const tool = new EditNoteTool(
      buildApp("Productivity/Sidekick suggestions test.md", note.filename),
      {} as Logger,
    );
    const [, result] = await tool.execute(buildState(note), {
      suggestions: [
        {
          note: "Productivity/Sidekick suggestions test.md",
          textToReplace: "missing text",
          replacement: "new text",
        },
      ],
    });

    expect(result.isError()).toBe(true);
    expect(result.llmOutputString()).toContain("## Errors");
    expect(result.llmOutputString()).toContain(
      "Text to replace not found in note",
    );
  });
});
