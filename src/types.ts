import { FunctionDeclaration } from "@google/genai";

export interface SidekickAgentState {
    readonly history: readonly HistoryEntry[];
    readonly notes: ReadonlyMap<string, Note>;
}

export type ToolResult = { output: string; verbose_result?: string } | { error: string; verbose_result?: string };

export interface SidekickTool {
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
    execute(state: SidekickAgentState, params: Record<string, unknown>): Promise<[SidekickAgentState, ToolResult]>;
}

export function createInitialState(): SidekickAgentState {
    return {
        history: [],
        notes: new Map(),
    };
}

export type HistoryEntry = TextHistoryEntry | ToolCallHistoryEntry;

export interface TextHistoryEntry {
    type: "text";
    role: "user" | "model";
    content: string;
}

export interface ToolCallHistoryEntry {
    type: "function_call";
    role: "model";
    call: {
        name: string;
        args: Record<string, unknown>;
    };
    result: ToolResult;
}

export interface Note {
    filename: string;
	structure?: string | null;
    content: string | null;
    links: string[];
    backlinks: string[];
    active?: boolean;
}


