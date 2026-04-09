import { type App, FuzzySuggestModal } from "obsidian";

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
    // Prefer Obsidian's tag index (fast/canonical).
    const getTagsFn = (
      this.app.metadataCache as unknown as {
        getTags?: () => Record<string, number>;
      }
    ).getTags;

    if (typeof getTagsFn !== "function") {
      return [];
    }

    return Object.keys(getTagsFn.call(this.app.metadataCache)).sort((a, b) =>
      a.localeCompare(b),
    );
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
