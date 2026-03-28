import type { App, TFile } from "obsidian";
import type { InputView } from "./input-view";
import { NoteSuggestionModal } from "./note-suggestion-modal";
import { TagSuggestionModal } from "./tag-suggestion-modal";

export class PlaintextInputView implements InputView {
  private app: App;
  private addNote: (basename: string) => Promise<void>;
  private onSendMessage: () => void;
  private inputEl: HTMLTextAreaElement;

  private constructor(
    container: HTMLElement,
    app: App,
    addNote: (basename: string) => Promise<void>,
    onSendMessage: () => void,
  ) {
    this.app = app;
    this.addNote = addNote;
    this.onSendMessage = onSendMessage;
    this.render(container);
  }

  static create(
    container: HTMLElement,
    app: App,
    addNote: (basename: string) => Promise<void>,
    onSendMessage: () => void,
  ): InputView {
    return new PlaintextInputView(container, app, addNote, onSendMessage);
  }

  private render(container: HTMLElement) {
    this.inputEl = container.createEl("textarea", {
      cls: "sidekick-plaintext-input",
      attr: {
        placeholder: "Type a prompt... (use [[ to add notes or # to add tags)",
      },
    });

    this.inputEl.addEventListener("input", () => {
      const value = this.inputEl.value;
      const cursor = this.inputEl.selectionStart;
      const lastChar = value.charAt(cursor - 1);
      const lastTwoChars = value.substring(cursor - 2, cursor);

      if (lastTwoChars === "[[") {
        this.openNoteModal();
      } else if (lastChar === "#") {
        this.openTagModal();
      }
    });

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.onSendMessage();
      }
    });
  }

  text(): string {
    return this.inputEl.value;
  }

  clear() {
    this.inputEl.value = "";
  }

  /**
   * Opens the tag suggestion modal and adds the selected tag to input.
   */
  private openTagModal() {
    new TagSuggestionModal(this.app, (tag: string) => {
      // Add to input text
      const cursor = this.inputEl.selectionStart;
      const value = this.inputEl.value;
      const before = value.substring(0, cursor);
      const after = value.substring(cursor);

      // If triggered by #, tag already contains # usually from getAllTags,
      // but let's be sure. getAllTags returns tags with #.
      const insertion = `${tag} `;
      if (before.endsWith("#") && tag.startsWith("#")) {
        // Remove the extra # if we already typed it
        this.inputEl.value =
          before.substring(0, before.length - 1) + insertion + after;
        this.inputEl.selectionStart = this.inputEl.selectionEnd =
          cursor - 1 + insertion.length;
      } else {
        this.inputEl.value = before + insertion + after;
        this.inputEl.selectionStart = this.inputEl.selectionEnd =
          cursor + insertion.length;
      }
      this.inputEl.focus();
    }).open();
  }

  /**
   * Opens the note suggestion modal and adds the selected note to context and input.
   */
  private openNoteModal() {
    new NoteSuggestionModal(this.app, (file: TFile) => {
      void (async () => {
        // Add to context
        await this.addNote(file.basename);

        // Add to input text
        const cursor = this.inputEl.selectionStart;
        const value = this.inputEl.value;
        const before = value.substring(0, cursor);
        const after = value.substring(cursor);

        // If triggered by [[, we might want to postfix it with ]]
        let insertion = `${file.basename} `;
        if (before.endsWith("[[")) {
          insertion = `${file.basename}]] `;
        }

        this.inputEl.value = before + insertion + after;
        this.inputEl.selectionStart = this.inputEl.selectionEnd =
          cursor + insertion.length;
        this.inputEl.focus();
      })();
    }).open();
  }
}
