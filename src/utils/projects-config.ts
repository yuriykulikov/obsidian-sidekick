import { type App, TFile } from "obsidian";

const CONFIG_FILE = "Projects.md";
const COLLAPSED_SECTION_HEADER = "# Collapsed";
const COLLAPSED_COLUMNS_SECTION_HEADER = "# Collapsed Columns";
const SORTING_SECTION_HEADER = "# Sorting";
const SEARCH_QUERY_SECTION_HEADER = "# Search";

export async function readSorting(app: App): Promise<string[]> {
  const file = app.vault.getAbstractFileByPath(CONFIG_FILE);
  if (!file || !(file instanceof TFile)) {
    return [];
  }

  const content = await app.vault.read(file);
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

export async function readCollapsedSwimlanes(app: App): Promise<Set<string>> {
  const file = app.vault.getAbstractFileByPath(CONFIG_FILE);
  if (!file || !(file instanceof TFile)) {
    return new Set();
  }

  const content = await app.vault.read(file);
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

export async function readSearchQuery(app: App): Promise<string> {
  const file = app.vault.getAbstractFileByPath(CONFIG_FILE);
  if (!file || !(file instanceof TFile)) {
    return "";
  }

  const content = await app.vault.read(file);
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

export async function readCollapsedColumns(app: App): Promise<Set<string>> {
  const file = app.vault.getAbstractFileByPath(CONFIG_FILE);
  if (!file || !(file instanceof TFile)) {
    return new Set();
  }

  const content = await app.vault.read(file);
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

export async function writeProjectConfig(
  app: App,
  collapsed: Set<string>,
  collapsedColumns: Set<string>,
  sorting: string[],
  searchQuery?: string,
): Promise<void> {
  const file = app.vault.getAbstractFileByPath(CONFIG_FILE);
  let content = "";
  if (file instanceof TFile) {
    content = await app.vault.read(file);
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
    await app.vault.modify(file, newContent);
  } else {
    await app.vault.create(CONFIG_FILE, newContent);
  }
}

export async function writeCollapsedSwimlanes(
  app: App,
  collapsed: Set<string>,
): Promise<void> {
  const sorting = await readSorting(app);
  const collapsedColumns = await readCollapsedColumns(app);
  const searchQuery = await readSearchQuery(app);
  await writeProjectConfig(
    app,
    collapsed,
    collapsedColumns,
    sorting,
    searchQuery,
  );
}

export async function writeCollapsedColumns(
  app: App,
  collapsedColumns: Set<string>,
): Promise<void> {
  const sorting = await readSorting(app);
  const collapsedSwimlanes = await readCollapsedSwimlanes(app);
  const searchQuery = await readSearchQuery(app);
  await writeProjectConfig(
    app,
    collapsedSwimlanes,
    collapsedColumns,
    sorting,
    searchQuery,
  );
}

export async function writeSearchQuery(
  app: App,
  searchQuery: string,
): Promise<void> {
  const sorting = await readSorting(app);
  const collapsedSwimlanes = await readCollapsedSwimlanes(app);
  const collapsedColumns = await readCollapsedColumns(app);
  await writeProjectConfig(
    app,
    collapsedSwimlanes,
    collapsedColumns,
    sorting,
    searchQuery,
  );
}
