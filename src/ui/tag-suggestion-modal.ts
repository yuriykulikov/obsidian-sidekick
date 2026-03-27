import { type App, FuzzySuggestModal, getAllTags } from "obsidian";

/**
 * A fuzzy search modal for selecting a tag from the vault.
 */
export class TagSuggestionModal extends FuzzySuggestModal<string> {
  private onSelect: (tag: string) => void;

  constructor(app: App, onSelect: (tag: string) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder("Search for a tag to add...");
  }

  /**
   * Returns all tags in the vault.
   */
  getItems(): string[] {
    const tags = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache) {
        const fileTags = getAllTags(cache);
        if (fileTags) {
          for (const tag of fileTags) {
            tags.add(tag);
          }
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * Returns the tag to display in the modal.
   */
  getItemText(tag: string): string {
    return tag;
  }

  /**
   * Callback when an item is selected.
   */
  onChooseItem(tag: string, _evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(tag);
  }
}
