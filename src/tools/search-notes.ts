import { App } from "obsidian";
import { FunctionDeclaration, Type } from "@google/genai";
import { SidekickAgentState, SidekickTool, ToolResult } from "../types";
import { SidekickLogger } from "../logger";

export class SearchNotesTool implements SidekickTool {
    constructor(private app: App, private logger: SidekickLogger) {}

    getDeclaration(): FunctionDeclaration {
        return {
            name: "search_notes",
            description: "Searches for notes by name/title. Returns a list of matching note titles.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    query: {
                        type: Type.STRING,
                        description: "The search query (part of the note title)."
                    }
                },
                required: ["query"]
            }
        };
    }

    async execute(state: SidekickAgentState, params: Record<string, unknown>): Promise<[SidekickAgentState, ToolResult]> {
        const query = (params.query as string).toLowerCase();
        
        const allFiles = this.app.vault.getMarkdownFiles();
        const matches = allFiles
            .filter(file => file.basename.toLowerCase().includes(query))
            .map(file => file.basename);

        if (matches.length === 0) {
            return [state, { output: `No notes found matching "${query}".` }];
        }

        const output = `Found ${matches.length} notes matching "${query}":\n` + 
                       matches.map(m => `- [[${m}]]`).join("\n");

        return [state, { 
            output: `Found ${matches.length} notes matching "${query}"`, 
            verbose_result: output
        }];
    }
}
