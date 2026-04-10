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
    expect(updated?.state?.hasSuggestions).toBe(true);
    expect(result.summary).toBe("Edited note: Sidekick suggestions test");
    expect(result.llmOutputString()).toContain(
      "# Note [[Sidekick suggestions test]]",
    );
    expect(result.llmOutputString()).toContain("1 suggestion:");
    expect(result.llmOutputString()).toContain("-old text");
    expect(result.llmOutputString()).toContain("+new text");
  });

  it("pluralizes summary when multiple notes were edited", async () => {
    const noteA: Note = {
      filename: "Note A",
      path: "Folder/Note A.md",
      content: "old a",
      links: [],
      backlinks: [],
      tags: [],
    };
    const noteB: Note = {
      filename: "Note B",
      path: "Folder/Note B.md",
      content: "old b",
      links: [],
      backlinks: [],
      tags: [],
    };

    const state = new AgentState(
      [],
      new Map([
        [noteA.filename, noteA],
        [noteB.filename, noteB],
      ]),
    );

    const tool = new EditNoteTool(
      {
        metadataCache: {
          getFirstLinkpathDest(path: string) {
            if (path === noteA.path || path === noteA.filename)
              return { basename: noteA.filename };
            if (path === noteB.path || path === noteB.filename)
              return { basename: noteB.filename };
            return null;
          },
        },
      } as unknown as App,
      {} as Logger,
    );

    const [, result] = await tool.execute(state, {
      suggestions: [
        { note: noteA.filename, textToReplace: "old a", replacement: "new a" },
        { note: noteB.filename, textToReplace: "old b", replacement: "new b" },
      ],
    });

    expect(result.summary).toBe("Edited notes: Note A, Note B");
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

  it("formats multi-line edits as a line-by-line diff", async () => {
    const note: Note = {
      filename: "Multi line",
      path: "Folder/Multi line.md",
      content: "prev line 1\nprev line 2\nlast line",
      links: [],
      backlinks: [],
      tags: [],
    };

    const tool = new EditNoteTool(
      buildApp(note.path, note.filename),
      {} as Logger,
    );
    const [, result] = await tool.execute(buildState(note), {
      suggestions: [
        {
          note: note.filename,
          textToReplace: "prev line 1\nprev line 2",
          replacement: "new line 1\nnew line 2\nnew line 3",
        },
      ],
    });

    const out = result.llmOutputString();
    expect(out).toContain(
      "-prev line 1\n-prev line 2\n\n+new line 1\n+new line 2\n+new line 3",
    );
  });
});
