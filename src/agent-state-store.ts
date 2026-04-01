import type { App } from "obsidian";
import {
  AgentState,
  type Note,
  type TextHistoryEntry,
  ToolResult,
} from "./types";
import type { Logger } from "./utils/logger";

export type AgentStateJson = {
  history: readonly HistoryEntryJson[];
  notes: readonly Note[];
  discoveredStructure: readonly string[];
  isThinking: boolean;
};

export type HistoryEntryJson = TextHistoryEntry | ToolCallHistoryEntryJson;

export interface ToolCallHistoryEntryJson {
  id: string;
  type: "function_call";
  role: "model";
  call: {
    name: string;
    args: Record<string, unknown>;
  };
  result: ToolResultJson;
  collapsed: boolean;
}

type ToolResultJson = {
  summary: string;
  output?: unknown;
  shortOutput?: unknown;
  error?: string;
};

function serializeToolResult(result: ToolResult): ToolResultJson {
  return {
    summary: result.summary,
    error: result.error,
    output: result.output,
    shortOutput: result.shortOutput,
  };
}

function deserializeToolResult(json: unknown): ToolResult {
  const obj = json as Record<string, unknown>;
  const summary = typeof obj.summary === "string" ? obj.summary : "Tool";

  const output = obj.output as unknown | undefined;
  const shortOutput = obj.shortOutput as unknown | undefined;
  const error = typeof obj.error === "string" ? obj.error : undefined;

  return new ToolResult(summary, output, shortOutput, error);
}

function serializeAgentState(state: AgentState): AgentStateJson {
  return {
    history: state.history.map((entry) => {
      if (entry.type !== "function_call") {
        return entry;
      }

      return {
        ...entry,
        // Persist tool results as plain JSON so they survive JSON.stringify/parse.
        result: serializeToolResult(entry.result),
      };
    }),
    // Persist notes as a plain array; reconstruct the Map by filename on load.
    notes: Array.from(state.notes.values()),
    discoveredStructure: state.discoveredStructure,
    isThinking: state.isThinking,
  };
}

// The core helpers are intentionally file-local for encapsulation, but tests need
// access to verify round-tripping behavior.
export function serializeAgentStateForTest(state: AgentState): AgentStateJson {
  return serializeAgentState(state);
}

function deserializeAgentState(json: {
  history?: readonly HistoryEntryJson[];
  notes?: readonly Note[];
  discoveredStructure?: readonly string[];
  isThinking?: boolean;
}): AgentState {
  const history = (json.history ?? []).map((entry) => {
    if (entry.type !== "function_call") {
      return entry;
    }

    // ToolResult will be a plain object after JSON.parse; normalize into a ToolResult instance.
    return {
      ...entry,
      result: deserializeToolResult(entry.result),
    };
  });
  const notes = new Map<string, Note>();
  for (const note of json.notes ?? []) {
    // Persisted notes are stored as a plain array; reconstruct the Map by filename.
    const key = note.filename || note.path;
    if (key) {
      notes.set(key, note);
    }
  }
  const discoveredStructure = json.discoveredStructure ?? [];
  const isThinking = json.isThinking ?? false;

  return new AgentState(history, notes, discoveredStructure, isThinking);
}

export function deserializeAgentStateForTest(json: {
  history?: readonly HistoryEntryJson[];
  notes?: readonly Note[];
  discoveredStructure?: readonly string[];
  isThinking?: boolean;
}): AgentState {
  return deserializeAgentState(json);
}

/**
 * Persists and restores {@link AgentState} in the vault.
 *
 * Storage location (relative to vault root): `.sidekick/state.json`
 */
export class AgentStateStore {
  private static readonly dirPath = ".sidekick";
  private static readonly filePath = `${AgentStateStore.dirPath}/state.json`;
  private static readonly storeDebounceMs = 300;

  private readonly app: App;
  private readonly logger: Logger;
  private storeToken: number | null = null;

  constructor(app: App, logger: Logger) {
    this.app = app;
    this.logger = logger;
  }

  public async load(): Promise<AgentState> {
    try {
      const stateString = await this.app.vault.adapter.read(
        AgentStateStore.filePath,
      );
      const stateJson = JSON.parse(stateString);
      return deserializeAgentState(stateJson);
    } catch (error) {
      this.logger.info(
        `No persisted state found or failed to load: ${error instanceof Error ? error.message : String(error)}. Starting with empty state.`,
      );
      return new AgentState();
    }
  }

  public store(state: AgentState): void {
    const token = Math.random();
    this.storeToken = token;
    window.setTimeout(() => {
      if (this.storeToken !== token) {
        return;
      }
      void this.storeStateToDisk(state);
    }, AgentStateStore.storeDebounceMs);
  }

  private async storeStateToDisk(state: AgentState): Promise<void> {
    try {
      const stateJson = serializeAgentState(state);
      const stateString = JSON.stringify(stateJson, null, 2);
      const adapter = this.app.vault.adapter;

      try {
        await adapter.mkdir(AgentStateStore.dirPath);
      } catch {
        // Directory may already exist; ignore.
      }

      await adapter.write(AgentStateStore.filePath, stateString);
    } catch (error) {
      this.logger.error(
        `Failed to store state: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
