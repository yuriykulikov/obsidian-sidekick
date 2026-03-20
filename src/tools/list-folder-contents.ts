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
            description: "Lists files and folders at a specific path in the vault. Returns metadata including mtime and tags for files, and recursive file counts for folders.",
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

        // Format output as object
        const output = {
            path: folder.path === "/" || folder.path === "" ? "/" : folder.path,
            items: items.map(item => ({
                name: item.filename,
                type: item.type,
                info: item.type === "file" 
                    ? (item.tags && item.tags.length > 0 ? `Tags: ${item.tags.join(", ")}` : "")
                    : `${item.file_count} files`
            })),
            total_items: items.length
        };

        const totalItems = items.length;
        const pretty = totalItems === 0 
            ? `Empty folder: ${folder.path}`
            : `Contents of ${folder.path}: ${items.map(i => i.filename + (i.type === "folder" ? "/" : "")).join(", ")}`;

        return [newState, { output, pretty }];
    }
}
