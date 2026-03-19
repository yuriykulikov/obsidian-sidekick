import { FunctionDeclaration } from "@google/genai";

export interface AgentState {
    readonly history: readonly HistoryEntry[];
    readonly notes: ReadonlyMap<string, Note>;
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
	execute(state: AgentState, params: Record<string, unknown>): Promise<[AgentState, ToolResult]>;
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

export type ToolResult = { output: string; verbose_result?: string } | { error: string; verbose_result?: string };

export interface Note {
    filename: string;
	structure?: string | null;
    content: string | null;
    links: string[];
    backlinks: string[];
    active?: boolean;
}

export function createInitialState(): AgentState {
    return {
        history: [],
        notes: new Map()
    };
}


