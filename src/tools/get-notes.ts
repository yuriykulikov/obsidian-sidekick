import { App } from "obsidian";
import { FunctionDeclaration, Type } from "@google/genai";
import { SidekickAgentState, SidekickTool, ToolResult } from "../types";
import { SidekickLogger } from "../logger";
import { readNote } from "../utils/notes";

export class GetNotesTool implements SidekickTool {
    constructor(private app: App, private logger: SidekickLogger) {}

    getDeclaration(): FunctionDeclaration {
        return {
            name: "read_note",
            description: "Fetches a note's structure, links, and backlinks. Content is also available upon request. Prioritize 'structure-only' to save tokens and quickly understand organization. Only use 'full' if the structure confirms high relevance.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    noteTitle: {
                        type: Type.STRING,
                        description: "The title or path of the note to fetch. Must be a note mentioned in the context (e.g., in links or backlinks of already read notes)."
                    },
                    detailLevel: {
                        type: Type.STRING,
                        description: "The level of detail to fetch. 'structure-only' fetches only the structure (headings, links) without content. 'full' fetches everything.",
                        enum: ["structure-only", "full"]
                    }
                },
                required: ["noteTitle"]
            }
        };
    }

    async execute(state: SidekickAgentState, params: Record<string, unknown>): Promise<[SidekickAgentState, ToolResult]> {
        const noteTitle = params.noteTitle as string;
        const detailLevel = (params.detailLevel as "structure-only" | "full") || "full";
        const file = this.app.metadataCache.getFirstLinkpathDest(noteTitle, "");
        if (!file) {
            this.logger.warn(`Note [[${noteTitle}]] not found.`);
            return [state, { error: `Note [[${noteTitle}]] not found.` }];
        }

        const filename = file.basename;
        const newNote = await readNote(this.app, file, detailLevel);

        const newNotes = new Map(state.notes);
        newNotes.set(filename, newNote);

        const newState = {
            ...state,
            notes: newNotes
        };

        return [newState, { 
            output: `Read ${detailLevel} contents of [[${filename}]]`, 
            verbose_result: `Successfully read ${detailLevel} contents of note [[${filename}]] and added it to the context for the next agent loop iteration.`
        }];
    }
}
