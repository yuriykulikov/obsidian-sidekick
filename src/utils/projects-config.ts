import { type App, TFile } from "obsidian";

const COLLAPSED_SECTION_HEADER = "# Collapsed";
const COLLAPSED_COLUMNS_SECTION_HEADER = "# Collapsed Columns";
const SORTING_SECTION_HEADER = "# Sorting";
const SEARCH_QUERY_SECTION_HEADER = "# Search";

export class ProjectConfig {
  constructor(
    private app: App,
    private configFilePath: string,
  ) {}

  /** Returns a list of all files in the Projects folder */
  getProjectFiles(): TFile[] {
    const files = this.app.vault.getMarkdownFiles();
    return files.filter((file) => {
      // Must be in Projects folder
      if (!file.path.startsWith("Projects/")) {
        return false;
      }
      // Filter out Kanban notes
      if (file.name.includes("Kanban")) {
        return false;
      }
      return true;
    });
  }

  async readSorting(): Promise<string[]> {
    const file = this.app.vault.getAbstractFileByPath(this.configFilePath);
    if (!file || !(file instanceof TFile)) {
      return [];
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const sorting: string[] = [];
    let inSortingSection = false;

    for (const line of lines) {
      if (line.trim() === SORTING_SECTION_HEADER) {
        inSortingSection = true;
        continue;
      }
      if (inSortingSection) {
        if (line.startsWith("#")) {
          break;
        }
        const match = line.match(/^[-*+]\s+(.+)$/);
        if (match?.[1]) {
          sorting.push(match[1].trim());
        }
      }
    }

    return sorting;
  }

  async readCollapsedSwimlanes(): Promise<Set<string>> {
    const file = this.app.vault.getAbstractFileByPath(this.configFilePath);
    if (!file || !(file instanceof TFile)) {
      return new Set();
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const collapsed = new Set<string>();
    let inCollapsedSection = false;

    for (const line of lines) {
      if (line.trim() === COLLAPSED_SECTION_HEADER) {
        inCollapsedSection = true;
        continue;
      }
      if (inCollapsedSection) {
        if (line.startsWith("#")) {
          break;
        }
        const match = line.match(/^[-*+]\s+(.+)$/);
        if (match?.[1]) {
          collapsed.add(match[1].trim());
        }
      }
    }

    return collapsed;
  }

  async readSearchQuery(): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(this.configFilePath);
    if (!file || !(file instanceof TFile)) {
      return "";
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    let inSearchSection = false;

    for (const line of lines) {
      if (line.trim() === SEARCH_QUERY_SECTION_HEADER) {
        inSearchSection = true;
        continue;
      }
      if (inSearchSection) {
        if (line.startsWith("#")) {
          break;
        }
        const match = line.match(/^[-*+]\s+(.+)$/);
        if (match?.[1]) {
          return match[1].trim();
        }
        if (line.trim() !== "") {
          return line.trim();
        }
      }
    }

    return "";
  }

  async readCollapsedColumns(): Promise<Set<string>> {
    const file = this.app.vault.getAbstractFileByPath(this.configFilePath);
    if (!file || !(file instanceof TFile)) {
      return new Set();
    }

    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    const collapsed = new Set<string>();
    let inSection = false;

    for (const line of lines) {
      if (line.trim() === COLLAPSED_COLUMNS_SECTION_HEADER) {
        inSection = true;
        continue;
      }
      if (inSection) {
        if (line.startsWith("#")) {
          break;
        }
        const match = line.match(/^[-*+]\s+(.+)$/);
        if (match?.[1]) {
          collapsed.add(match[1].trim());
        }
      }
    }

    return collapsed;
  }

  async writeProjectConfig(
    collapsed: Set<string>,
    collapsedColumns: Set<string>,
    sorting: string[],
    searchQuery?: string,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(this.configFilePath);
    let content = "";
    if (file instanceof TFile) {
      content = await this.app.vault.read(file);
    }

    const lines = content.split("\n");
    const newLines: string[] = [];
    let inSection = false;

    const sectionsToProcess = [
      {
        header: COLLAPSED_SECTION_HEADER,
        items: Array.from(collapsed).sort(),
        found: false,
      },
      {
        header: COLLAPSED_COLUMNS_SECTION_HEADER,
        items: Array.from(collapsedColumns).sort(),
        found: false,
      },
      {
        header: SORTING_SECTION_HEADER,
        items: sorting,
        found: false,
      },
      {
        header: SEARCH_QUERY_SECTION_HEADER,
        items: searchQuery ? [searchQuery] : [],
        found: false,
      },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const currentSection = sectionsToProcess.find(
        (s) => line.trim() === s.header,
      );

      if (currentSection) {
        inSection = true;
        currentSection.found = true;
        newLines.push(currentSection.header);
        newLines.push("");
        for (const item of currentSection.items) {
          newLines.push(`- ${item}`);
        }
        continue;
      }

      if (inSection) {
        if (line.startsWith("#")) {
          inSection = false;
          newLines.push("");
          newLines.push(line);
        }
        // Skip lines in the current section
        continue;
      }

      newLines.push(line);
    }

    for (const section of sectionsToProcess) {
      if (!section.found) {
        if (newLines.length > 0) {
          const lastLine = newLines[newLines.length - 1];
          if (lastLine !== undefined && lastLine.trim() !== "") {
            newLines.push("");
          }
        }
        newLines.push(section.header);
        newLines.push("");
        for (const item of section.items) {
          newLines.push(`- ${item}`);
        }
      }
    }

    // Cleanup trailing newlines
    while (newLines.length > 0) {
      const lastLine = newLines[newLines.length - 1];
      if (lastLine !== undefined && lastLine.trim() === "") {
        if (newLines.length === 1) {
          newLines.pop();
        } else {
          const secondLastLine = newLines[newLines.length - 2];
          if (secondLastLine !== undefined && secondLastLine.trim() === "") {
            newLines.pop();
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    const newContent = `${newLines.join("\n").trim()}\n`;

    if (file instanceof TFile) {
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.create(this.configFilePath, newContent);
    }
  }

  async writeCollapsedSwimlanes(collapsed: Set<string>): Promise<void> {
    const sorting = await this.readSorting();
    const collapsedColumns = await this.readCollapsedColumns();
    const searchQuery = await this.readSearchQuery();
    await this.writeProjectConfig(
      collapsed,
      collapsedColumns,
      sorting,
      searchQuery,
    );
  }

  async writeCollapsedColumns(collapsedColumns: Set<string>): Promise<void> {
    const sorting = await this.readSorting();
    const collapsedSwimlanes = await this.readCollapsedSwimlanes();
    const searchQuery = await this.readSearchQuery();
    await this.writeProjectConfig(
      collapsedSwimlanes,
      collapsedColumns,
      sorting,
      searchQuery,
    );
  }

  async writeSearchQuery(searchQuery: string): Promise<void> {
    const sorting = await this.readSorting();
    const collapsedSwimlanes = await this.readCollapsedSwimlanes();
    const collapsedColumns = await this.readCollapsedColumns();
    await this.writeProjectConfig(
      collapsedSwimlanes,
      collapsedColumns,
      sorting,
      searchQuery,
    );
  }
}
