import type { App, TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { AgentState, type Note } from "../types";
import type { Logger } from "../utils/logger";
import * as readNoteModule from "../utils/read-note";
import { EditNoteTool } from "./edit-note";

describe("EditNoteTool - load from vault", () => {
  it("loads note from vault if not in context", async () => {
    const noteContent = "content in vault";
    const filename = "NoteInVault";
    const path = "NoteInVault.md";

    const mockFile = { basename: filename, path: path } as TFile;
    const mockApp = {
      metadataCache: {
        getFirstLinkpathDest: vi.fn().mockReturnValue(mockFile),
      },
      vault: {
        read: vi.fn().mockResolvedValue(noteContent),
      },
    } as unknown as App;

    const mockLogger = {
      warn: vi.fn(),
    } as unknown as Logger;

    // Spy on readNote to avoid actual vault access if possible, or just mock what it needs
    const readNoteSpy = vi.spyOn(readNoteModule, "readNote").mockResolvedValue({
      filename,
      path,
      content: noteContent,
      links: [],
      backlinks: [],
      tags: [],
    } as Note);

    const state = new AgentState([], new Map());
    const tool = new EditNoteTool(mockApp, mockLogger);

    const [newState, result] = await tool.execute(state, {
      suggestions: [
        {
          note: filename,
          textToReplace: "content",
          replacement: "new content",
        },
      ],
    });

    if (result.isError()) {
      console.log("[DEBUG_LOG] Result error:", result.llmOutputString());
    }

    expect(result.isError()).toBe(false);
    const updated = newState.notes.get(filename);
    expect(updated?.content).toBe("new content in vault");
    expect(readNoteSpy).toHaveBeenCalledWith(mockApp, mockFile, "text");

    readNoteSpy.mockRestore();
  });
});
