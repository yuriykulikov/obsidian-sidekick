import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { AgentState } from "../types";
import type { Logger } from "../utils/logger";
import { readNote } from "../utils/read-note";
import { CreateNoteTool } from "./create-note";

vi.mock("../utils/read-note", () => ({
  readNote: vi.fn(),
}));

describe("CreateNoteTool", () => {
  const mockLogger = {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;

  const buildApp = (exists = false) => {
    return {
      vault: {
        getAbstractFileByPath: vi.fn().mockReturnValue(exists ? {} : null),
        create: vi.fn().mockResolvedValue({
          basename: "NewNote",
          path: "NewNote.md",
          extension: "md",
          parent: { path: "/" },
        }),
        createFolder: vi.fn().mockResolvedValue({}),
      },
      metadataCache: {
        getFileCache: vi.fn().mockReturnValue({}),
        resolvedLinks: {},
      },
    } as unknown as App;
  };

  it("should create a new note", async () => {
    const app = buildApp(false);
    const tool = new CreateNoteTool(app, mockLogger);
    const prevState = new AgentState();

    vi.mocked(readNote).mockResolvedValue({
      filename: "NewNote",
      path: "NewNote.md",
      content: "Hello world",
      links: [],
      backlinks: [],
      tags: [],
    });

    const [newState, result] = await tool.execute(prevState, {
      name: "NewNote",
      content: "Hello world",
    });

    expect(result.isError()).toBe(false);
    expect(newState.notes.has("NewNote")).toBe(true);
    expect(newState.notes.get("NewNote")?.state?.created).toBe(true);
  });

  it("should return error if file already exists", async () => {
    const app = buildApp(true);
    const tool = new CreateNoteTool(app, mockLogger);
    const prevState = new AgentState();

    const [newState, result] = await tool.execute(prevState, {
      name: "ExistingNote",
      content: "Some content",
    });

    expect(result.isError()).toBe(true);
    expect(result.summary).toContain("failed");
    expect(newState).toBe(prevState);
  });
});
