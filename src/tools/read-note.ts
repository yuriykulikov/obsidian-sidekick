import { App } from "obsidian";
import { FunctionDeclaration, Type } from "@google/genai";
import { AgentState, ToolResult, Tool } from "../types";
import { Logger } from "../utils/logger";
import { readNote } from "../utils/notes";

export class ReadNoteTool implements Tool {
    constructor(private app: App, private logger: Logger) {}

    getDeclaration(): FunctionDeclaration {
        return {
            name: "read_note",
            description: "Fetches a note's structure, links, and backlinks. Content is also available upon request. Prioritize 'structure' to save tokens and quickly understand organization.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    noteTitle: {
                        type: Type.STRING,
                        description: "The title or path of the note to fetch. Must be a note mentioned in the context (e.g., in links or backlinks of already read notes)."
                    },
                    detail: {
                        type: Type.STRING,
                        description: "The level of detail to fetch. 'structure' fetches headings and links. 'text' fetches everything.",
                        enum: ["structure", "text"]
                    }
                },
                required: ["noteTitle"]
            }
        };
    }

    async execute(state: AgentState, params: Record<string, unknown>): Promise<[AgentState, ToolResult]> {
        const noteTitle = params.noteTitle as string;
        const detail = (params.detail as "structure" | "text") || "text";
        const file = this.app.metadataCache.getFirstLinkpathDest(noteTitle, "");
        if (!file) {
            this.logger.warn(`Note [[${noteTitle}]] not found.`);
            return [state, { error: `Note [[${noteTitle}]] not found.` }];
        }

        const filename = file.basename;
        const newNote = await readNote(this.app, file, detail);

        const newState = state.appendNote(filename, newNote).appendDiscoveredStructure([file.path]);

        const output = `Successfully read ${detail} of note [[${filename}]] and added it to the context for the next agent loop iteration.`;

        return [newState, { 
            output: output,
            pretty: `Read ${detail} of [[${filename}]]`
        }];
    }
}
