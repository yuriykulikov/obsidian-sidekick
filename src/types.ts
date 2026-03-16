export interface SidekickAgentState {
    readonly history: readonly HistoryEntry[];
    readonly notes: ReadonlyMap<string, Note>;
}

export function createInitialState(): SidekickAgentState {
    return {
        history: [],
        notes: new Map(),
    };
}

export interface AgentResponse {
    type: "final";
    content: string;
    newState: SidekickAgentState;
}

export interface HistoryEntry {
    type: "text";
    role: "user" | "model";
    content: string;
}

export interface Note {
    filename: string;
    content?: string;
}

