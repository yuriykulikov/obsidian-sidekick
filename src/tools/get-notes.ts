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
            description: "Fetches a note's content, links, and backlinks.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    noteTitle: {
                        type: Type.STRING,
                        description: "The title or path of the note to fetch."
                    }
                },
                required: ["noteTitle"]
            }
        };
    }

    async execute(state: SidekickAgentState, params: Record<string, unknown>): Promise<[SidekickAgentState, ToolResult]> {
        const noteTitle = params.noteTitle as string;
        const file = this.app.metadataCache.getFirstLinkpathDest(noteTitle, "");
        if (!file) {
            this.logger.warn(`Note [[${noteTitle}]] not found.`);
            return [state, { error: `Note [[${noteTitle}]] not found.` }];
        }

        const filename = file.basename;
        if (state.notes.has(filename)) {
            this.logger.info(`Note [[${filename}]] already in context.`);
            return [state, { output: `Note [[${filename}]] already in context.` }];
        }

        const newNote = await readNote(this.app, file);

        const newNotes = new Map(state.notes);
        newNotes.set(filename, newNote);

        const newState = {
            ...state,
            notes: newNotes
        };

        return [newState, { 
            output: `Read contents of [[${filename}]]`, 
            verbose_result: `Successfully read contents of note [[${filename}]] and added it to the context for the next agent loop iteration.`
        }];
    }
}
