import type { FunctionDeclaration } from "@google/genai";

export class AgentState {
  constructor(
    public readonly history: readonly HistoryEntry[] = [],
    public readonly notes: ReadonlyMap<string, Note> = new Map(),
    public readonly discoveredStructure: readonly string[] = [],
    public readonly isThinking: boolean = false,
  ) {}

  public appendHistoryEntry(item: HistoryEntry): AgentState {
    return new AgentState(
      [...this.history, item],
      this.notes,
      this.discoveredStructure,
      this.isThinking,
    );
  }

  public replaceNotes(notes: ReadonlyMap<string, Note>): AgentState {
    return new AgentState(
      this.history,
      notes,
      this.discoveredStructure,
      this.isThinking,
    );
  }

  public appendNote(filename: string, note: Note): AgentState {
    const mergedNotes = new Map(this.notes);
    mergedNotes.set(filename, note);
    return new AgentState(
      this.history,
      mergedNotes,
      this.discoveredStructure,
      this.isThinking,
    );
  }

  public removeNote(filename: string): AgentState {
    const mergedNotes = new Map(this.notes);
    mergedNotes.delete(filename);
    return new AgentState(
      this.history,
      mergedNotes,
      this.discoveredStructure,
      this.isThinking,
    );
  }

  public setHistoryEntryCollapsed(id: string, collapsed: boolean): AgentState {
    return new AgentState(
      this.history.map((entry) => {
        if (entry.type === "function_call" && entry.id === id) {
          return { ...entry, collapsed };
        }
        return entry;
      }),
      this.notes,
      this.discoveredStructure,
      this.isThinking,
    );
  }

  public appendDiscoveredStructure(newPaths: readonly string[]): AgentState {
    return new AgentState(
      this.history,
      this.notes,
      Array.from(new Set([...this.discoveredStructure, ...newPaths])),
      this.isThinking,
    );
  }

  public setThinking(isThinking: boolean): AgentState {
    return new AgentState(
      this.history,
      this.notes,
      this.discoveredStructure,
      isThinking,
    );
  }
}

export interface Tool {
  /**
   * Returns the Gemini API function declaration for this tool.
   */
  getDeclaration(): FunctionDeclaration;

  /**
   * Executes the tool and returns the updated agent state and the tool execution result.
   * @param state The current agent state.
   * @param params The parameters provided by the LLM.
   * @returns A promise that resolves to a tuple [newState, result].
   */
  execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]>;
}

export type HistoryEntry = TextHistoryEntry | ToolCallHistoryEntry;

export interface TextHistoryEntry {
  type: "text";
  role: "user" | "model";
  content: string;
}

export interface ToolCallHistoryEntry {
  id: string;
  type: "function_call";
  role: "model";
  call: {
    name: string;
    args: Record<string, unknown>;
  };
  result: ToolResult;
  collapsed: boolean;
}

/**
 * Result return from Tool. output and error are given to the LLM, other properties are used in UI and logs.
 */
export type ToolResult = ({ output: unknown } | { error: string }) & {
  verbose?: string;
  summary: string;
};

export interface Note {
  filename: string;
  path: string;
  structure?: string | null;
  content: string | null;
  links: string[];
  backlinks: string[];
  tags: string[];
  active?: boolean;
  parentPath?: string;
  folderSiblings?: string[] | null;
}
