import type { App } from "obsidian";
import { describe, expect, it } from "vitest";
import { AgentState, type Note } from "../types";
import { Logger } from "../utils/logger";
import { DeleteNoteTool } from "./delete-note";

function buildState(note: Note): AgentState {
  const notes = new Map<string, Note>();
  notes.set(note.filename, note);
  return new AgentState(undefined, notes);
}

function buildApp(notePath: string, basename: string): App {
  return {
    metadataCache: {
      getFirstLinkpathDest: (path: string) => {
        if (path === notePath || path === basename) {
          return { basename };
        }
        return null;
      },
    },
  } as unknown as App;
}

describe("DeleteNoteTool", () => {
  const logger = new Logger();

  it("marks an existing note as deleted", async () => {
    const note: Note = {
      filename: "Test Note",
      path: "Test Note.md",
      content: "Initial content",
      links: [],
      backlinks: [],
      tags: [],
    };
    const state = buildState(note);
    const app = buildApp("Test Note.md", "Test Note");
    const tool = new DeleteNoteTool(app, logger);

    const [newState, result] = await tool.execute(state, {
      notes: ["Test Note"],
    });

    expect(result.isError()).toBe(false);
    expect(result.summary).toContain("Marked for deletion: Test Note");
    const updatedNote = newState.notes.get("Test Note");
    expect(updatedNote?.state?.deleted).toBe(true);
  });

  it("returns an error if the note is not in the context", async () => {
    const state = new AgentState();
    const app = buildApp("Nonexistent.md", "Nonexistent");
    const tool = new DeleteNoteTool(app, logger);

    const [newState, result] = await tool.execute(state, {
      notes: ["Nonexistent"],
    });

    expect(result.isError()).toBe(true);
    expect(result.summary).toContain("failed to delete notes");
    expect(newState).toBe(state);
  });

  it("handles multiple notes", async () => {
    const note1: Note = {
      filename: "Note 1",
      path: "Note 1.md",
      content: "Content 1",
      links: [],
      backlinks: [],
      tags: [],
    };
    const note2: Note = {
      filename: "Note 2",
      path: "Note 2.md",
      content: "Content 2",
      links: [],
      backlinks: [],
      tags: [],
    };
    const notes = new Map<string, Note>();
    notes.set(note1.filename, note1);
    notes.set(note2.filename, note2);
    const state = new AgentState(undefined, notes);

    const app = {
      metadataCache: {
        getFirstLinkpathDest: (path: string) => {
          if (path === "Note 1") return { basename: "Note 1" };
          if (path === "Note 2") return { basename: "Note 2" };
          return null;
        },
      },
    } as unknown as App;

    const tool = new DeleteNoteTool(app, logger);

    const [newState, result] = await tool.execute(state, {
      notes: ["Note 1", "Note 2"],
    });

    expect(result.isError()).toBe(false);
    expect(newState.notes.get("Note 1")?.state?.deleted).toBe(true);
    expect(newState.notes.get("Note 2")?.state?.deleted).toBe(true);
  });
});
