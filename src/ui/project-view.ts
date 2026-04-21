import {
  getAllTags,
  ItemView,
  setIcon,
  type TFile,
  type WorkspaceLeaf,
} from "obsidian";
import type { Logger } from "../utils/logger";

export const VIEW_TYPE_PROJECTS = "sidekick-projects-view";

export class ProjectView extends ItemView {
  private projectAreaEl: HTMLElement;

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

  private render() {
    const _start = performance.now();
    const container = this.containerEl.children[1] as HTMLElement;

    container.empty();
    container.addClass("sidekick-project-container");

    const header = container.createDiv({ cls: "sidekick-project-header" });
    header.createEl("h4", { text: "Project Notes" });

    const reloadButton = header.createEl("button", {
      cls: "sidekick-project-reload-button",
      title: "Reload projects",
    });
    setIcon(reloadButton, "refresh-cw");
    reloadButton.addEventListener("click", () => {
      this.renderProjectArea();
    });

    this.projectAreaEl = container.createDiv();

    this.renderProjectArea();
  }

  private renderProjectArea() {
    const container = this.projectAreaEl;
    container.empty();

    const projectFiles = this.getProjectFiles();

    if (projectFiles.length === 0) {
      container.createEl("p", { text: "No notes tagged with #project found." });
      return;
    }

    // 1. Build an inventory of all possible statuses
    const statuses = this.getUniqueStatuses(projectFiles);

    // 2. Group all projects based on the tag (project/ski and so on)
    const groupedProjects = this.groupProjectsByTag(projectFiles);

    const board = container.createDiv({ cls: "sidekick-project-board" });

    // 3. Render Swimlanes (Tags)
    for (const [tag, tagGroup] of Object.entries(groupedProjects)) {
      this.renderSwimlane(board, tag, tagGroup, statuses);
    }
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

  private groupProjectsByTag(
    files: TFile[],
  ): Record<string, Record<string, TFile[]>> {
    const grouped: Record<string, Record<string, TFile[]>> = {};

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      const status = frontmatter?.status || "No Status";

      const allTags = cache ? getAllTags(cache) : [];
      const projectTags =
        allTags
          ?.filter((tag) => {
            const t = tag.toLowerCase();
            return (
              t === "#project" ||
              t === "project" ||
              t.startsWith("#project/") ||
              t.startsWith("project/")
            );
          })
          .map((tag) => {
            const t = tag.startsWith("#") ? tag.substring(1) : tag;
            if (t.toLowerCase().startsWith("project/")) {
              return t.substring("project/".length);
            }
            return "General";
          }) || [];

      const tagsToUse = projectTags.length > 0 ? projectTags : ["General"];

      for (const tag of tagsToUse) {
        if (!grouped[tag]) grouped[tag] = {};
        if (!grouped[tag][status]) grouped[tag][status] = [];
        grouped[tag][status].push(file);
      }
    }

    const sortedTags = Object.keys(grouped).sort((a, b) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });

    const sortedGrouped: Record<string, Record<string, TFile[]>> = {};
    for (const tag of sortedTags) {
      const tagGroups = grouped[tag];
      if (tagGroups) {
        sortedGrouped[tag] = tagGroups;
      }
    }

    return sortedGrouped;
  }

  private renderSwimlane(
    container: HTMLElement,
    tag: string,
    statusGroups: Record<string, TFile[]>,
    statuses: string[],
  ) {
    const swimlane = container.createDiv({ cls: "sidekick-project-swimlane" });
    swimlane.createEl("h5", {
      cls: "sidekick-project-swimlane-heading",
      text: tag,
    });

    const row = swimlane.createDiv({ cls: "sidekick-project-row" });

    for (const status of statuses) {
      const files = statusGroups[status] || [];

      const column = row.createDiv({ cls: "sidekick-project-column" });
      column.createEl("div", {
        cls: "sidekick-project-column-title",
        text: status,
      });

      for (const file of files) {
        const card = column.createDiv({ cls: "sidekick-project-card" });
        const link = card.createEl("a", {
          cls: "sidekick-project-link",
          text: file.basename,
        });

        link.addEventListener("click", (e) => {
          e.preventDefault();
          this.app.workspace.getLeaf(false).openFile(file);
        });

        const path = card.createEl("div", {
          cls: "sidekick-project-path",
          text: file.path,
        });
        path.style.fontSize = "0.7em";
        path.style.color = "var(--text-muted)";
      }
    }
  }

  /** Returns a list of all files which has #project tag or any subtag */
  private getProjectFiles(): TFile[] {
    const _start = performance.now();
    const files = this.app.vault.getMarkdownFiles();
    const result = files.filter((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache) {
        const tags = getAllTags(cache) || [];
        const hasProjectTag = tags.some((tag) => {
          const t = tag.toLowerCase();
          return (
            t === "#project" ||
            t === "project" ||
            t.startsWith("#project/") ||
            t.startsWith("project/")
          );
        });
        return hasProjectTag;
      }
      return false;
    });
    const _end = performance.now();
    return result;
  }
}
