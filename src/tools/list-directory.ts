import { type FunctionDeclaration, Type } from "@google/genai";
import { type App, TFile, TFolder } from "obsidian";
import type { AgentState, Tool } from "../types";
import { ToolResult } from "../types";
import type { Logger } from "../utils/logger";

export class ListDirectoryTool implements Tool {
  constructor(
    private app: App,
    _logger: Logger,
  ) {}

  getDeclaration(): FunctionDeclaration {
    return {
      name: "list_directory",
      description:
        "Lists files and folders at a specific path in the vault. Returns a markdown list with folder paths and file counts, and file names.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          path: {
            type: Type.STRING,
            description:
              "The path relative to the vault root (e.g., '/', 'Work/Projects'). Defaults to '/'.",
          },
        },
      },
    };
  }

  async execute(
    state: AgentState,
    params: Record<string, unknown>,
  ): Promise<[AgentState, ToolResult]> {
    const path = (params.path as string) || "/";

    const folder = await this.getFolder(path);

    if (!folder) {
      const message = `Path not found or is not a folder: ${path}`;
      return [
        state,
        ToolResult.createError(
          `List directory: ${path} not found or is not a folder`,
          message,
        ),
      ];
    }

    const folderPath =
      folder.path === "/" || folder.path === "" ? "/" : folder.path;
    let output = `### Contents of ${folderPath}\n\n`;

    if (folder.children.length === 0) {
      output += "_Folder is empty._";
    } else {
      const folderLines: string[] = [];
      const fileLines: string[] = [];

      for (const child of folder.children) {
        if (child instanceof TFile && child.extension === "md") {
          fileLines.push(`- ${child.basename}`);
        } else if (child instanceof TFolder) {
          let count = 0;
          const countFiles = (f: TFolder) => {
            for (const c of f.children) {
              if (c instanceof TFile && c.extension === "md") count++;
              else if (c instanceof TFolder) countFiles(c);
            }
          };
          countFiles(child);
          folderLines.push(`- ${child.name}/ (${count} files)`);
        }
      }

      if (folderLines.length > 0) {
        output += "#### Folders\n";
        output += `${folderLines.join("\n")}\n\n`;
      }

      if (fileLines.length > 0) {
        output += "#### Notes\n";
        output += `${fileLines.join("\n")}\n\n`;
      }

      output += `Total items: ${folder.children.length}`;
    }

    const totalItems = folder.children.length;
    const summary =
      totalItems === 0
        ? `List directory: empty folder ${folderPath}`
        : `List directory: ${folderPath} (${totalItems} items)`;

    const newState = state.appendDiscoveredStructure([
      folder.path,
      ...folder.children.map((c) => c.path),
    ]);

    const discoveredCount = totalItems + 1;
    const shortOutput =
      totalItems === 0
        ? `Listed directory ${folderPath}. Added ${folderPath} to the discovered vault structure in context.`
        : `Listed directory ${folderPath}. Added this folder and its ${totalItems} child item${totalItems === 1 ? "" : "s"} (${discoveredCount} paths total) to the discovered vault structure in context.`;

    return [newState, ToolResult.createOkShort(summary, output, shortOutput)];
  }

  /**
   * Resolves a path to a folder in the vault.
   *
   * @param path The path to the folder.
   * @returns The resolved folder object or null if not found or not a folder.
   */
  private async getFolder(path: string): Promise<TFolder | null> {
    const segments = path.split("/").filter((s) => s.length > 0);
    const resolvedSegments: string[] = [];

    for (const segment of segments) {
      if (segment === "..") {
        resolvedSegments.pop();
      } else if (segment !== ".") {
        resolvedSegments.push(segment);
      }
    }

    const normalizedPath = resolvedSegments.join("/");

    // Obsidian vault root is accessed via empty string.
    // We handle both empty string and "/" by normalizing.
    let abstractFile = this.app.vault.getAbstractFileByPath(normalizedPath);

    // If not found and it was intended to be root, try "/"
    if (!abstractFile && normalizedPath === "") {
      abstractFile = this.app.vault.getAbstractFileByPath("/");
    }

    if (abstractFile instanceof TFolder) {
      return abstractFile;
    }

    return null;
  }
}
