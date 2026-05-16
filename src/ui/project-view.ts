import {
  ItemView,
  Menu,
  normalizePath,
  setIcon,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { Logger } from "../utils/logger";
import {
  readCollapsedColumns,
  readCollapsedSwimlanes,
  readSorting,
  writeCollapsedColumns,
  writeCollapsedSwimlanes,
  writeProjectConfig,
} from "../utils/projects-config";

export const VIEW_TYPE_PROJECTS = "sidekick-projects-view";

export class ProjectView extends ItemView {
  private projectAreaEl: HTMLElement;
  private collapsedSwimlanes: Set<string> = new Set();
  private collapsedColumns: Set<string> = new Set();

  constructor(leaf: WorkspaceLeaf, _logger: Logger) {
    super(leaf);
  }
  getViewType(): string {
    return VIEW_TYPE_PROJECTS;
  }

  getDisplayText(): string {
    return "Projects";
  }

  getIcon(): string {
    return "folder-kanban";
  }

  async onOpen() {
    this.render();
  }

  private async render() {
    const _start = performance.now();
    const container = this.containerEl.children[1] as HTMLElement;

    container.empty();
    container.addClass("sidekick-project-container");

    const header = container.createDiv({ cls: "sidekick-project-top-bar" });

    const reloadButton = header.createEl("button", {
      cls: "sidekick-header-button",
      title: "Reload projects",
    });
    setIcon(reloadButton, "refresh-cw");
    reloadButton.addEventListener("click", () => {
      this.renderProjectArea();
    });

    this.projectAreaEl = container.createDiv({ cls: "sidekick-project-area" });

    await this.renderProjectArea();
  }

  private async renderProjectArea() {
    const container = this.projectAreaEl;
    container.empty();

    // Load state from Projects.md
    this.collapsedSwimlanes = await readCollapsedSwimlanes(this.app);
    this.collapsedColumns = await readCollapsedColumns(this.app);
    let statuses = await readSorting(this.app);

    const projectFiles = this.getProjectFiles();

    if (projectFiles.length === 0) {
      container.createEl("p", { text: "No notes in Projects folder found." });
      return;
    }

    // 1. Build an inventory of all possible statuses
    if (statuses.length === 0) {
      statuses = this.getUniqueStatuses(projectFiles);

      // If sorting was empty, we save the current columns for next time
      if (statuses.length > 0) {
        await writeProjectConfig(
          this.app,
          this.collapsedSwimlanes,
          this.collapsedColumns,
          statuses,
        );
      }
    }

    // 2. Group all projects based on the path
    const groupedProjects = this.groupProjectsByPath(projectFiles, statuses);

    const board = container.createDiv({ cls: "sidekick-project-board" });

    // Render Status Bar
    this.renderStatusBar(board, statuses, projectFiles);

    // 3. Render Swimlanes (Groups)
    for (const [group, groupData] of Object.entries(groupedProjects)) {
      this.renderSwimlane(board, group, groupData, statuses);
    }
  }

  private renderStatusBar(
    container: HTMLElement,
    statuses: string[],
    projectFiles: TFile[],
  ) {
    const statusBar = container.createDiv({
      cls: "sidekick-project-status-bar",
    });

    const totalCounts: Record<string, number> = {};
    for (const status of statuses) {
      totalCounts[status] = 0;
    }

    const defaultStatus = statuses[0] || "No Status";

    for (const file of projectFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      let status = cache?.frontmatter?.status;
      if (!status || !statuses.includes(status)) {
        status = defaultStatus;
      }
      totalCounts[status] = (totalCounts[status] || 0) + 1;
    }

    for (const status of statuses) {
      const isCollapsed = this.collapsedColumns.has(status);
      const item = statusBar.createDiv({
        cls: `sidekick-project-status-bar-item ${isCollapsed ? "is-collapsed" : ""}`,
      });
      item.createDiv({
        cls: "sidekick-project-status-bar-title",
        text: status,
      });
      item.createDiv({
        cls: "sidekick-project-status-bar-counter",
        text: (totalCounts[status] || 0).toString(),
      });

      item.addEventListener("click", async () => {
        if (this.collapsedColumns.has(status)) {
          this.collapsedColumns.delete(status);
        } else {
          this.collapsedColumns.add(status);
        }
        await writeCollapsedColumns(this.app, this.collapsedColumns);
        this.renderProjectArea();
      });
    }
  }

  private renderSwimlane(
    container: HTMLElement,
    group: string,
    statusGroups: Record<string, TFile[]>,
    statuses: string[],
  ) {
    const isCollapsed = this.collapsedSwimlanes.has(group);
    const swimlane = container.createDiv({
      cls: `sidekick-project-swimlane ${isCollapsed ? "is-collapsed" : ""}`,
    });

    const heading = swimlane.createDiv({
      cls: "sidekick-project-swimlane-header",
    });

    const toggleIcon = heading.createSpan({
      cls: "sidekick-project-swimlane-toggle-button",
    });
    setIcon(toggleIcon, isCollapsed ? "chevron-right" : "chevron-down");

    heading.createEl("h5", {
      cls: "sidekick-project-swimlane-header-title",
      text: group,
    });

    const countersRow = swimlane.createDiv({
      cls: "sidekick-project-swimlane-header-counters-row",
    });

    for (const status of statuses) {
      const files = statusGroups[status] || [];
      const colCollapsed = this.collapsedColumns.has(status);
      countersRow.createDiv({
        cls: `sidekick-project-swimlane-header-counters-row-item ${colCollapsed ? "is-collapsed" : ""}`,
        text: files.length.toString(),
      });
    }

    const row: HTMLDivElement = swimlane.createDiv({
      cls: "sidekick-project-swimlane-cards-area",
    });

    if (isCollapsed) {
      row.style.display = "none";
    }

    heading.addEventListener("click", async () => {
      if (this.collapsedSwimlanes.has(group)) {
        this.collapsedSwimlanes.delete(group);
        row.style.display = "flex";
        setIcon(toggleIcon, "chevron-down");
        swimlane.removeClass("is-collapsed");
      } else {
        this.collapsedSwimlanes.add(group);
        row.style.display = "none";
        setIcon(toggleIcon, "chevron-right");
        swimlane.addClass("is-collapsed");
      }

      await writeCollapsedSwimlanes(this.app, this.collapsedSwimlanes);
    });

    for (const status of statuses) {
      const files = statusGroups[status] || [];
      this.renderColumn(status, files, row, statuses, group);
    }
  }

  /**
   * Render a column with files and a footer for adding new files
   */
  private renderColumn(
    status: string,
    files: TFile[],
    row: HTMLDivElement,
    statuses: string[],
    group: string,
  ) {
    const isCollapsed = this.collapsedColumns.has(status);
    const column = row.createDiv({
      cls: `sidekick-project-swimlane-cards-area-column ${isCollapsed ? "is-collapsed" : ""}`,
    });

    if (isCollapsed) {
      return;
    }

    for (const file of files) {
      this.renderCard(column, file, statuses, status);
    }

    const columnFooter = column.createDiv({
      cls: "sidekick-project-swimlane-cards-area-column-footer",
    });
    this.addPlusButtonToFooter(columnFooter, status, group);
  }

  /**
   * Add a plus button to the column footer
   */
  private addPlusButtonToFooter(
    columnFooter: HTMLDivElement,
    status: string,
    group: string,
  ) {
    const addButton = columnFooter.createDiv({
      cls: "sidekick-project-swimlane-cards-area-column-footer-plus-button",
      title: `Add project to ${status}`,
    });
    setIcon(addButton, "plus");

    addButton.addEventListener("click", async () => {
      const folderPath = group === "General" ? "Projects" : `Projects/${group}`;

      // Ensure folder exists
      if (!(await this.app.vault.adapter.exists(folderPath))) {
        await this.app.vault.createFolder(folderPath);
      }

      let _title = "New Project";
      let fileName = "New Project.md";
      let filePath = normalizePath(`${folderPath}/${fileName}`);
      let counter = 1;

      while (await this.app.vault.adapter.exists(filePath)) {
        _title = `New Project ${counter}`;
        fileName = `New Project ${counter}.md`;
        filePath = normalizePath(`${folderPath}/${fileName}`);
        counter++;
      }

      const content = `---
status: "${status}"
---
#project

## Desired outcome

## Actions
- [ ] 
`;

      const file = await this.app.vault.create(filePath, content);
      await this.app.workspace.getLeaf(true).openFile(file);
      await this.renderProjectArea();
    });
  }

  private renderCard(
    column: HTMLDivElement,
    file: TFile,
    statuses: string[],
    status: string,
  ) {
    const card = column.createDiv({ cls: "sidekick-project-card" });

    const cardHeader = card.createEl("a", {
      cls: "sidekick-project-card-title",
      text: file.basename,
    });

    cardHeader.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      this.app.workspace.getLeaf(false).openFile(file);
    });

    this.addCardStatusMenu(cardHeader, statuses, status, file);
    this.addProgressBar(file, card);
  }

  /**
   * Add a progress bar for tasks
   */
  private addProgressBar(file: TFile, card: HTMLDivElement) {
    const cache = this.app.metadataCache.getFileCache(file);
    const listItems = cache?.listItems || [];
    const tasks = listItems.filter((item) => item.task !== undefined);

    if (tasks.length > 0) {
      const completedTasks = tasks.filter(
        (item) => item.task === "x" || item.task === "X",
      ).length;
      const totalTasks = tasks.length;
      const percentage = Math.round((completedTasks / totalTasks) * 100);

      const progressContainer = card.createDiv({
        cls: "sidekick-project-card-progress",
      });

      const progressBarContainer = progressContainer.createDiv({
        cls: "sidekick-project-card-progress-bar",
      });

      progressBarContainer.createDiv({
        cls: "sidekick-project-card-progress-bar-fill",
      }).style.width = `${percentage}%`;

      progressContainer.createDiv({
        cls: "sidekick-project-card-progress-text",
        text: `${completedTasks}/${totalTasks} tasks (${percentage}%)`,
      });
    }
  }

  /**
   * Adds a menu to change card status
   */
  private addCardStatusMenu(
    container: HTMLElement,
    statuses: string[],
    status: string,
    file: TFile,
  ) {
    const statusBtn = container.createDiv({
      cls: "sidekick-project-card-status-button",
      title: "Change status",
    });
    setIcon(statusBtn, "more-vertical");

    statusBtn.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const menu = new Menu();

      for (const s of statuses) {
        menu.addItem((item) => {
          item
            .setTitle(s)
            .setChecked(s === status)
            .onClick(async () => {
              if (s === status) return;

              await this.app.fileManager.processFrontMatter(
                file,
                (frontmatter) => {
                  frontmatter.status = s;
                },
              );

              // Wait a bit for metadata cache to update
              await new Promise((resolve) => setTimeout(resolve, 300));

              // Refresh the view
              this.renderProjectArea();
            });
        });
      }

      menu.showAtMouseEvent(e);
    });
  }

  private getUniqueStatuses(files: TFile[]): string[] {
    const statusSet = new Set<string>();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const status = cache?.frontmatter?.status || "No Status";
      statusSet.add(status);
    }

    if (statusSet.size === 0) {
      statusSet.add("No Status");
    }

    return Array.from(statusSet).sort();
  }

  private groupProjectsByPath(
    files: TFile[],
    availableStatuses: string[],
  ): Record<string, Record<string, TFile[]>> {
    const grouped: Record<string, Record<string, TFile[]>> = {};

    const defaultStatus = availableStatuses[0] || "No Status";

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      let status = frontmatter?.status;

      if (!status || !availableStatuses.includes(status)) {
        status = defaultStatus;
      }

      // Projects/Subfolder/Note.md -> Subfolder
      // Projects/Note.md -> General
      const pathParts = file.path.split("/");
      let group = "General";
      if (pathParts.length > 2) {
        group = pathParts[1] ?? "General";
      }

      if (!grouped[group]) grouped[group] = {};
      const groupData = grouped[group];
      if (groupData) {
        if (!groupData[status]) groupData[status] = [];
        groupData[status]?.push(file);
      }
    }

    const sortedGroups = Object.keys(grouped).sort((a, b) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });

    const sortedGrouped: Record<string, Record<string, TFile[]>> = {};
    for (const group of sortedGroups) {
      const groupItems = grouped[group];
      if (groupItems) {
        sortedGrouped[group] = groupItems;
      }
    }

    return sortedGrouped;
  }

  /** Returns a list of all files in the Projects folder */
  private getProjectFiles(): TFile[] {
    const _start = performance.now();
    const files = this.app.vault.getMarkdownFiles();
    const result = files.filter((file) => {
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
    const _end = performance.now();
    return result;
  }
}
