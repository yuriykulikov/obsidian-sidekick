import { FunctionDeclaration } from "@google/genai";

export interface AgentState {
    readonly history: readonly HistoryEntry[];
    readonly notes: ReadonlyMap<string, Note>;
    readonly folders: ReadonlyMap<string, Folder>;
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
    pretty?: string;
}

export type ToolResult = { output: unknown; verbose_result?: string; pretty?: string } | { error: string; verbose_result?: string; pretty?: string };

export interface Note {
	filename: string;
	path: string;
	structure?: string | null;
	content: string | null;
	links: string[];
	backlinks: string[];
	active?: boolean;
    parent?: Folder;
}

export interface File {
    filename: string;
    path: string;
    type: "file";
    mtime: number;
    tags: string[];
}

export interface Folder {
    filename: string;
    path: string;
    type: "folder";
    file_count: number;
    children: (File | Folder)[];
}

export function createInitialState(): AgentState {
    return {
        history: [],
        notes: new Map(),
        folders: new Map(),
    };
}


