import { type Extension, Prec } from "@codemirror/state";
import {
  type EditorView,
  keymap,
  placeholder,
  type ViewUpdate,
} from "@codemirror/view";
import type { App, Constructor, TFile } from "obsidian";
import { extractLinks } from "../utils/read-note";
import type { InputView } from "./input-view";

let cachedMarkdownInputViewClass: Constructor<InputView> | null = null;

/**
 * Creates a markdown editor instance embedded in a container.
 *
 * Uses internal Obsidian APIs to create an editor similar to note editor (working popups, suggestions, etc.).
 */
export function createMarkdownEditor(
  container: HTMLElement,
  app: App,
  addNote: (basename: string) => Promise<void>,
  onSendMessage: () => void,
): InputView {
  const MarkdownInputEditorClass = getMarkdownInputEditorClass(app);

  // biome-ignore lint/suspicious/noExplicitAny: constructor needs to be any because it's a dynamic class
  return new (MarkdownInputEditorClass as any)(
    app,
    container,
    onSendMessage,
    addNote,
  );
}

/**
 * Creates a subclass of ScrollableMarkdownEditor that can be embedded in other views.
 */
function getMarkdownInputEditorClass(app: App): Constructor<InputView> {
  if (cachedMarkdownInputViewClass) {
    return cachedMarkdownInputViewClass;
  }

  const ScrollableEditorBaseClass =
    resolveScrollableMarkdownEditorConstructor(app);

  const MarkdownInputView = class MarkdownInputView
    extends (ScrollableEditorBaseClass as unknown as Constructor<ScrollableMarkdownEditor>)
    implements InputView
  {
    onSendMessage: () => void;
    addNote: (basename: string) => Promise<void>;

    constructor(
      app: App,
      container: HTMLElement,
      onSendMessage: () => void,
      addNote: (basename: string) => Promise<void>,
    ) {
      super(app, container, {
        app,
        onMarkdownScroll: () => {},
        getMode: () => "source",
      });
      this.onSendMessage = onSendMessage;
      this.addNote = addNote;
      this.editorEl.addClass("sidekick-markdown-input");
    }

    /**
     * Add notes to the context when they are mentioned in the text.
     */
    async onUpdate(update: ViewUpdate, changed: boolean): Promise<void> {
      super.onUpdate(update, changed);

      if (changed) {
        const text = update.state.doc.toString();
        const basenames = extractLinks(text);
        for (const basename of basenames) {
          await this.addNote(basename);
        }
      }
    }

    /**
     * Returns the current text content of the editor.
     */
    text(): string {
      return this.editor.cm.state.doc.toString();
    }

    /**
     * Clears the editor by setting its content to an empty string.
     */
    clear(): void {
      this.set("");
    }

    /**
     * Loads the CM extensions for rendering Markdown and handling user inputs
     * Note that other plugins will not be able to send updates to these extensions to change configurations
     */
    buildLocalExtensions(): Extension[] {
      const extensions = super.buildLocalExtensions();
      extensions.push(
        placeholder("Type a prompt... (use [[ to add notes or # to add tags)"),
      );

      extensions.push(
        Prec.highest(
          keymap.of([
            {
              key: "Enter",
              run: (_cm) => {
                this.onSendMessage();
                return true;
              },
            },
            {
              key: "Mod-Enter",
              run: (_cm) => {
                this.onSendMessage();
                return true;
              },
            },
          ]),
        ),
      );

      return extensions;
    }

    destroy(): void {
      if (this._loaded) this.unload();
      this.containerEl.empty();
      super.destroy();
    }

    onunload() {
      super.onunload();
      this.destroy();
    }
  };

  cachedMarkdownInputViewClass =
    MarkdownInputView as unknown as Constructor<InputView>;
  return cachedMarkdownInputViewClass;
}

/**
 * Resolves Obsidian's internal markdown editor constructor.
 *
 * The MIT License
 *
 * Original code by mgmeyers in https://github.com/mgmeyers/obsidian-kanban/blob/main/src/components/Editor/MarkdownEditor.tsx
 * Modified by Fevol in https://gist.github.com/Fevol/caa478ce303e69eabede7b12b2323838
 *
 * LICENSE DISCLAIMER: Original source code of Kanban is GPLv3, explicit permission was given for sharing the editor construction code under MIT.
 * Resolves Obsidian's internal markdown editor constructor.
 *
 */
function resolveScrollableMarkdownEditorConstructor(
  app: App,
): Constructor<ScrollableMarkdownEditor> {
  // biome-ignore lint/suspicious/noExplicitAny: Internal Obsidian API
  const widgetEditorView = (app as any).embedRegistry.embedByExtension.md(
    { app, containerEl: document.createElement("div") },
    null as unknown as TFile,
    "",
  ) as unknown as WidgetEditorView;

  widgetEditorView.editable = true;
  widgetEditorView.showEditor();

  const markdownEditor = Object.getPrototypeOf(
    // biome-ignore lint/style/noNonNullAssertion: editMode is guaranteed after showEditor
    Object.getPrototypeOf(widgetEditorView.editMode!),
  );

  widgetEditorView.unload();

  return markdownEditor.constructor as Constructor<ScrollableMarkdownEditor>;
}

/**
 * Internal Obsidian typings
 */
interface ScrollableMarkdownEditor {
  containerEl: HTMLElement;
  editorEl: HTMLElement;
  editor: {
    cm: EditorView;
  };
  _loaded: boolean;
  set(value: string): void;
  unload(): void;
  onUpdate(update: ViewUpdate, changed: boolean): Promise<void> | void;
  buildLocalExtensions(): Extension[];
  destroy(): void;
  onunload(): void;
}

/**
 * Internal Obsidian typings
 */
interface WidgetEditorView {
  editable: boolean;
  editMode?: ScrollableMarkdownEditor;
  showEditor(): void;
  unload(): void;
}
