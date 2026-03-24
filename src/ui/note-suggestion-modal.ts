import { type App, FuzzySuggestModal, type TFile } from "obsidian";

/**
 * A fuzzy search modal for selecting a note from the vault.
 */
export class NoteSuggestionModal extends FuzzySuggestModal<TFile> {
  private onSelect: (file: TFile) => void;

  constructor(app: App, onSelect: (file: TFile) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder("Search for a note to add to context...");
  }

  /**
   * Returns all Markdown files in the vault.
   */
  getItems(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  /**
   * Returns the name of the file to display in the modal.
   */
  getItemText(file: TFile): string {
    return file.basename;
  }

  /**
   * Callback when an item is selected.
   */
  onChooseItem(file: TFile, _evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(file);
  }
}
