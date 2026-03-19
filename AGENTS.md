# Obsidian community plugin

Sidekick is an AI agent for [Obsidian](https://obsidian.md), designed to be your companion in managing and growing your
knowledge base. Much like a coding agent for your vault, Sidekick treats Markdown as structured text and focuses on the
unique relationships within your Obsidian vault.

## Design Philosophy

For more information, see the [Design Document](docs/design-doc.md).

- **Structure-Based Context**: Sidekick treats Markdown as structured text. Instead of relying on embeddings or vector
  databases, it builds context through the natural architecture of your vault: links, backlinks, tags, tasks, and
  directory hierarchy.
- **Obsidian Native**: Sidekick uses the Obsidian API and vault structure, navigating your notes like a developer
  navigates a codebase.
- **Simple UI/UX**: Simple task-based interface.

### Environment & tooling

- Node.js: current LTS (Node 18+).
- **Package manager: npm** (required for `package.json` scripts).
- **Bundler: esbuild** (defined in `esbuild.config.mjs`).
- Types: `obsidian` type definitions.

## File & folder conventions

Source lives in `src/`:
  ```
  src/
    main.ts           # Plugin entry point, lifecycle management
    agent.ts          # AI Agent logic and tool integration
    settings.ts       # Settings interface and defaults
    tools/           # AI tool implementations (note operations, etc.)
      read-note.ts
      search-notes.ts
    ui/              # UI components, modals, views
      chat-view.ts
      log-view.ts
      note-suggestion-modal.ts
    utils/           # Utility functions, helpers
      logger.ts
      notes.ts
    types.ts         # TypeScript interfaces and types
  ```

## Security, privacy, and compliance

Follow Obsidian's **Developer Policies** and **Plugin Guidelines**. In particular:

- Default to local/offline operation. Only make network requests when essential to the feature.
- No hidden telemetry. If you collect optional analytics or call third-party services, require explicit opt-in and document clearly in `README.md` and in settings.
- Never execute remote code, fetch and eval scripts, or auto-update plugin code outside of normal releases.
- Minimize scope: read/write only what's necessary inside the vault. Do not access files outside the vault.
- Clearly disclose any external services used, data sent, and risks.
- Respect user privacy. Do not collect vault contents, filenames, or personal information unless absolutely necessary and explicitly consented.
- Avoid deceptive patterns, ads, or spammy notifications.
- Register and clean up all DOM, app, and interval listeners using the provided `register*` helpers so the plugin unloads safely.

## Coding conventions

- TypeScript with `"strict": true` preferred.
- **Split large files**: If any file exceeds ~200-300 lines, consider breaking it into smaller, focused modules.
- **Use clear module boundaries**: Each file should have a single, well-defined responsibility.
- Prefer `async/await` over promise chains; handle errors gracefully.

## Agent do/don't

**Do**
- Use `this.register*` helpers for everything that needs cleanup.
- Use `this.logger` for debugging and informational messages to ensure they are visible in the plugin's log view.

**Don't**
- **Do not modify `main.js` directly**: It is a compiled file. Always make changes in the `src/` directory.
- **Do not use Notice** except for errors.

**Before finishing a task**
- **Run linting**: Run `npm run lint` and fix all errors and warnings.
- **Run build**: Run `npm run build` to ensure the project compiles and bundles correctly.

## Common tasks

### Register listeners safely

```ts
this.registerEvent(this.app.workspace.on("file-open", f => { /* ... */ }));
this.registerDomEvent(window, "resize", () => { /* ... */ });
this.registerInterval(window.setInterval(() => { /* ... */ }, 1000));
```

## References

- Obsidian sample plugin: https://github.com/obsidianmd/obsidian-sample-plugin
- API documentation: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
- Gemini API documentation: https://ai.google.dev/api
