import type { FunctionDeclaration } from "@google/genai";

export class AgentState {
  /**
   * Do not use parameter property shorthand - does not work in Webstorm.
   */
  public readonly history: readonly HistoryEntry[];
  public readonly notes: ReadonlyMap<string, Note>;
  public readonly discoveredStructure: readonly string[];
  public readonly isThinking: boolean;

  constructor(
    history: readonly HistoryEntry[] = [],
    notes: ReadonlyMap<string, Note> = new Map<string, Note>(),
    discoveredStructure: readonly string[] = [],
    isThinking: boolean = false,
  ) {
    this.history = history;
    this.notes = notes;
    this.discoveredStructure = discoveredStructure;
    this.isThinking = isThinking;
  }

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
 * Result returned from a Tool.
 * - `summary`: one-line human-readable description shown in the UI tool card header.
 * - `verbose`: full human-readable detail shown when the tool card is expanded.
 * - `llmOutput()`: the `{ output } | { error }` object passed to the LLM as the function response.
 * - `historyEntry()`: the condensed string stored in tool-call history (prefers shortOutput over output).
 */
export class ToolResult {
  public readonly summary: string;
  public readonly output: unknown | undefined;
  public readonly shortOutput: unknown | undefined;
  public readonly error: string | undefined;

  constructor(
    summary: string,
    output: unknown | undefined,
    shortOutput: unknown | undefined,
    error: string | undefined,
  ) {
    this.summary = summary;
    this._output = output;
    this._shortOutput = shortOutput;
    this._error = error;
  }

  /** Creates a successful result where the LLM and history both receive `output`. */
  static createOk(summary: string, output: unknown): ToolResult {
    return new ToolResult(summary, output, undefined, undefined);
  }

  /**
   * Creates a successful result with a separate short form for the LLM history entry.
   * `output` is used as the full verbose display and as the LLM function-response body.
   * `shortOutput` is used as the condensed history entry passed back into the LLM context.
   */
  static createOkShort(
    summary: string,
    output: unknown,
    shortOutput: unknown,
  ): ToolResult {
    return new ToolResult(summary, output, shortOutput, undefined);
  }

  /** Creates an error result. */
  static createError(summary: string, error: string): ToolResult {
    return new ToolResult(summary, undefined, undefined, error);
  }

  /** Returns true if this result represents an error. */
  isError(): boolean {
    return this._error !== undefined;
  }

  /**
   * Returns the object suitable for passing as a function response to the LLM.
   * Shape: `{ output: unknown } | { error: string }`.
   */
  llmOutput(): { output: unknown } | { error: string } {
    if (this._error !== undefined) {
      return { error: this._error };
    }
    return { output: this._output };
  }

  /**
   * Returns the function response payload value as a string (either `output` or `error`).
   */
  llmOutputString(): string {
    const llmOutput = this.llmOutput();
    const value = "error" in llmOutput ? llmOutput.error : llmOutput.output;
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }

  /**
   * Returns the condensed string for tool-call history entries (and shown under
   * collapsed history cards). Prefers `shortOutput` over `output`; falls back to `error`.
   */
  historyEntry(): string {
    const value =
      this._error !== undefined
        ? this._error
        : (this._shortOutput ?? this._output ?? "");
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  }
}

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
