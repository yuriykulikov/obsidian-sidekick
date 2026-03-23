import { FunctionDeclaration } from "@google/genai";

export class AgentState {
    constructor(
        public readonly history: readonly HistoryEntry[] = [],
        public readonly notes: ReadonlyMap<string, Note> = new Map(),
        public readonly discoveredStructure: readonly string[] = []
    ) {}

    public appendHistoryEntry(item: HistoryEntry): AgentState {
        return new AgentState(
            [...this.history, item],
            this.notes,
            this.discoveredStructure
        );
    }

    public replaceNotes(notes: ReadonlyMap<string, Note>): AgentState {
        return new AgentState(
            this.history,
            notes,
            this.discoveredStructure
        );
    }

    public appendNote(filename: string, note: Note): AgentState {
        const mergedNotes = new Map(this.notes);
        mergedNotes.set(filename, note);
        return new AgentState(
            this.history,
            mergedNotes,
            this.discoveredStructure
        );
    }

    public appendDiscoveredStructure(newPaths: readonly string[]): AgentState {
        return new AgentState(
            this.history,
            this.notes,
            Array.from(new Set([...this.discoveredStructure, ...newPaths]))
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
	parentPath?: string;
	folderSiblings?: string[];
}

export function createInitialState(): AgentState {
    return new AgentState();
}


