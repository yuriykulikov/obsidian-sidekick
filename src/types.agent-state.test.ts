import { describe, expect, it } from "vitest";

import {
  type AgentStateJson,
  deserializeAgentStateForTest,
  serializeAgentStateForTest,
} from "./agent-state-store";
import { AgentState, type HistoryEntry, type Note, ToolResult } from "./types";

describe("AgentState serialization", () => {
  it("round-trips via toJson/fromJson", () => {
    const note: Note = {
      filename: "a.md",
      path: "a.md",
      structure: null,
      content: "hello",
      links: ["b.md"],
      backlinks: [],
      tags: ["#tag"],
      state: {
        active: true,
        hasSuggestions: true,
      },
      parentPath: "",
      folderSiblings: null,
    };

    const history: HistoryEntry[] = [
      { type: "text", role: "user", content: "hi" },
      {
        type: "function_call",
        role: "model",
        id: "1",
        call: { name: "tool", args: { x: 1 } },
        result: ToolResult.createOk("ok", { y: 2 }),
        collapsed: true,
      },
    ];

    const state = new AgentState(
      history,
      new Map([["a.md", note]]),
      ["folder/a.md", "folder/b.md"],
      true,
    );

    const json: AgentStateJson = serializeAgentStateForTest(state);

    // Notes are persisted as a plain array; ordering follows insertion order.
    expect(json.notes).toEqual([note]);
    const restored = deserializeAgentStateForTest(json);

    // The JSON shapes should match exactly for symmetry.
    expect(serializeAgentStateForTest(restored)).toEqual(json);
  });
});
