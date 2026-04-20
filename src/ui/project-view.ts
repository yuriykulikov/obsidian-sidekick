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

    // Capture scroll position
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;

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
      this.render();
    });

    const projectFiles = this.getProjectFiles();

    if (projectFiles.length === 0) {
      container.createEl("p", { text: "No notes tagged with #project found." });
      return;
    }

    const { groupedProjects, statuses } =
      this.groupAndIdentifyStatuses(projectFiles);

    if (statuses.length === 0) {
      statuses.push("No Status");
    }

    const board = container.createDiv({ cls: "sidekick-project-board" });

    // Render Swimlanes (Tags)
    for (const [tag, statusGroups] of Object.entries(groupedProjects)) {
      const swimlane = board.createDiv({ cls: "sidekick-project-swimlane" });
      swimlane.createEl("h5", {
        cls: "sidekick-project-swimlane-heading",
        text: tag,
      });

      const row = swimlane.createDiv({ cls: "sidekick-project-row" });

      for (const status of statuses) {
        const files = statusGroups[status] || [];
        if (files.length === 0) continue;

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

    // Restore scroll position
    container.scrollTop = scrollTop;
    container.scrollLeft = scrollLeft;

    const _end = performance.now();
  }

  private groupAndIdentifyStatuses(files: TFile[]): {
    groupedProjects: Record<string, Record<string, TFile[]>>;
    statuses: string[];
  } {
    const grouped: Record<string, Record<string, TFile[]>> = {};
    const statusSet = new Set<string>();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      const status = frontmatter?.status || "No Status";
      statusSet.add(status);

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

    return {
      groupedProjects: sortedGrouped,
      statuses: Array.from(statusSet).sort(),
    };
  }

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
        const isArchived = tags.some((tag) => {
          const _t = tag.toLowerCase();
          return false; // t === "#archive" || t === "archive";
        });
        return hasProjectTag && !isArchived;
      }
      return false;
    });
    const _end = performance.now();
    return result;
  }
}
