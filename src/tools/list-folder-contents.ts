import { App } from "obsidian";
import { FunctionDeclaration, Type } from "@google/genai";
import { AgentState, Tool, ToolResult } from "../types";
import { Logger } from "../utils/logger";
import { listFolderContents } from "../utils/notes";

export class ListFolderContents implements Tool {
    constructor(private app: App, private logger: Logger) {}

    getDeclaration(): FunctionDeclaration {
        return {
            name: "list_folder_contents",
            description: "Lists files and folders at a specific path in the vault. Returns a markdown list with folder paths and file counts, and file names.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    path: {
                        type: Type.STRING,
                        description: "The path relative to the vault root (e.g., '/', 'Work/Projects'). Defaults to '/'."
                    },
                    depth: {
                        type: Type.NUMBER,
                        description: "How many levels to explore. Currently, only shallow (1) is supported. Defaults to 1."
                    }
                }
            }
        };
    }

    async execute(state: AgentState, params: Record<string, unknown>): Promise<[AgentState, ToolResult]> {
        const path = (params.path as string) || "/";

        const result = await listFolderContents(this.app, state, path);

        if (!result) {
            return [state, { error: `Path not found or is not a folder: ${path}` }];
        }

        const [newState, folder, items] = result;

        // Format output as a plain list
        const folderPath = folder.path === "/" || folder.path === "" ? "/" : folder.path;
        let output = `### Contents of ${folderPath}\n\n`;
        
        if (items.length === 0) {
            output += "_Folder is empty._";
        } else {
            for (const item of items) {
                if (item.type === "folder") {
                    output += `- ${item.filename}/ (${item.file_count} files)\n`;
                } else {
                    output += `- ${item.filename}\n`;
                }
            }
            output += `\nTotal items: ${items.length}`;
        }

        const totalItems = items.length;
        const pretty = totalItems === 0 
            ? `Empty folder: ${folder.path}`
            : `Contents of ${folderPath}`;

        return [newState, { output, pretty }];
    }
}
