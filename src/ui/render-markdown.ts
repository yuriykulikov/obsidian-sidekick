import { type App, type Component, Keymap, MarkdownRenderer } from "obsidian";

/**
 * Renders markdown with open and hover working.
 * https://forum.obsidian.md/t/internal-links-dont-work-in-custom-view/90169/3
 */
export function renderMarkdown(
  app: App,
  content: string,
  containerEl: HTMLElement,
  component: Component,
) {
  const sourcePath =
    app.workspace.getActiveFile()?.path ?? app.vault.getRoot().path;

  MarkdownRenderer.render(app, content, containerEl, sourcePath, component);

  containerEl.querySelectorAll("a.internal-link").forEach((el) => {
    el.addEventListener("click", (evt: MouseEvent) => {
      evt.preventDefault();
      const linktext = el.getAttribute("href");
      if (linktext) {
        app.workspace.openLinkText(
          linktext,
          sourcePath,
          Keymap.isModEvent(evt),
        );
      }
    });

    el.addEventListener("mouseover", (event: MouseEvent) => {
      event.preventDefault();
      const linktext = el.getAttribute("href");
      if (linktext) {
        app.workspace.trigger("hover-link", {
          event,
          source: "preview",
          hoverParent: { hoverPopover: null },
          targetEl: event.currentTarget,
          linktext: linktext,
          sourcePath: sourcePath,
        });
      }
    });
  });

  containerEl.querySelectorAll("a.tag").forEach((el) => {
    if (!(el instanceof HTMLAnchorElement)) return;
    el.addEventListener("click", (evt: MouseEvent) => {
      evt.preventDefault();
      const tag = el.innerText.trim();
      if (tag) {
        // biome-ignore lint/suspicious/noExplicitAny: Obsidian internal API
        (app as any).internalPlugins
          .getPluginById("global-search")
          .instance.openGlobalSearch(`tag:${tag}`);
      }
    });
  });
}
