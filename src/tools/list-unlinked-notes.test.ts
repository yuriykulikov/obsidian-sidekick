import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import { AgentState } from "../types";
import { ListUnlinkedNotesTool } from "./list-unlinked-notes";

function makeMdFile(path: string): TFile {
  const base = path.split("/").pop() ?? path;
  const basename = base.replace(/\.md$/i, "");

  // Minimal TFile shape for our tool: instanceof checks + extension/path/basename
  const file = Object.create(TFile.prototype) as TFile;
  Object.assign(file, {
    path,
    extension: "md",
    basename,
  });
  return file;
}

function makeNonMdFile(path: string, extension: string): TFile {
  const base = path.split("/").pop() ?? path;
  const basename = base.replace(new RegExp(`\\.${extension}$`, "i"), "");

  const file = Object.create(TFile.prototype) as TFile;
  Object.assign(file, {
    path,
    extension,
    basename,
  });
  return file;
}

function makeApp(
  files: TFile[],
  resolvedLinks: Record<string, Record<string, number>>,
  cacheByPath: Record<string, unknown> = {},
) {
  return {
    vault: {
      getAllLoadedFiles: () => files,
    },
    metadataCache: {
      resolvedLinks,
      getCache: (path: string) => cacheByPath[path],
    },
  };
}

describe("ListUnlinkedNotesTool", () => {
  it("returns notes with zero inbound links and ignores non-markdown files", async () => {
    const files = [
      makeMdFile("a.md"),
      makeMdFile("b.md"),
      makeMdFile("c.md"),
      makeNonMdFile("image.png", "png"),
    ];

    // a -> b. c has no backlinks.
    const app = makeApp(
      files,
      {
        "a.md": { "b.md": 1 },
      },
      {
        "a.md": { tags: [] },
        "b.md": { tags: [] },
        "c.md": { tags: [] },
      },
    );

    const tool = new ListUnlinkedNotesTool(app as never, console as never);
    const [newState, result] = await tool.execute(new AgentState(), {});

    expect(result.isError()).toBe(false);
    expect(result.summary).toContain("found 2");
    expect(result.llmOutputString()).toContain("[[a.md]]");
    expect(result.llmOutputString()).toContain("[[c.md]]");

    // discoveredStructure includes returned page
    expect(newState.discoveredStructure).toEqual(["a.md", "c.md"]);
  });

  it("returns results in stable sorted order", async () => {
    const files = [makeMdFile("z.md"), makeMdFile("a.md"), makeMdFile("m.md")];

    const app = makeApp(
      files,
      {},
      {
        "a.md": { tags: [] },
        "m.md": { tags: [] },
        "z.md": { tags: [] },
      },
    );

    const tool = new ListUnlinkedNotesTool(app as never, console as never);
    const [state1, result1] = await tool.execute(new AgentState(), {});

    expect(result1.summary).toContain("found 3");
    expect(result1.llmOutputString()).toContain("[[a.md]]");
    expect(result1.llmOutputString()).toContain("[[m.md]]");
    expect(result1.llmOutputString()).toContain("[[z.md]]");
    expect(state1.discoveredStructure).toEqual(["a.md", "m.md", "z.md"]);
  });

  it("excludes notes which have tags", async () => {
    const files = [
      makeMdFile("Inbox/a.md"),
      makeMdFile("Inbox/b.md"),
      makeMdFile("Templates/t.md"),
      makeMdFile("Projects/p.md"),
    ];

    // Only Inbox/b.md has a backlink.
    const app = makeApp(
      files,
      {
        "Projects/p.md": { "Inbox/b.md": 1 },
      },
      {
        // Inbox/a.md is unlinked but has tags -> should be excluded
        "Inbox/a.md": { tags: [{ tag: "#keep" }] },
        "Inbox/b.md": { tags: [] },
        "Templates/t.md": { tags: [] },
        "Projects/p.md": { tags: [] },
      },
    );

    const tool = new ListUnlinkedNotesTool(app as never, console as never);
    const [_newState, result] = await tool.execute(new AgentState(), {});

    expect(result.llmOutputString()).not.toContain("Inbox/a.md");
    expect(result.llmOutputString()).not.toContain("Inbox/b.md");
    // still can show other files; the key behavior is that tagged notes are excluded
  });
});
