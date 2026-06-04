# Obsidian community plugin

Sidekick is an AI agent for [Obsidian](https://obsidian.md).
Much like a coding agent, Sidekick treats Markdown as structured text and focuses on the relationships within the
Obsidian vault.

## Progressive disclosure

Documentation in this repository is progressively disclosed. Pull in files into the context when deemed necessary.
Check for Markdown files when planning using tree command (`tree -P "*.md" --prune -I node_modules`)

- **Core Architecture & Design**: See [docs/design-doc.md](docs/design-doc.md) and linked files for the Factory pattern,
  transducer loop, and design principles.
- **UI Development**: See [src/ui/UI-GUIDELINES.md](src/ui/UI-GUIDELINES.md) for Component Decomposition and CSS rules.

## Repository structure

  ```
  docs/              # Design documentation
  src/               
    main.ts          # Plugin entry point, lifecycle management
    agent.ts         # AI Agent logic and tool integration
    settings.ts      # Settings interface and defaults
    css/             # CSS source files (compiled to styles.css)
    tools/           # AI tool implementations (note operations, etc.)
    ui/              # UI components, modals, views. Make sure to load [src/ui/UI-GUIDELINES.md](src/ui/UI-GUIDELINES.md) when working here
    utils/           # Utility functions, helpers
    types.ts         # TypeScript interfaces and types
  ```

## Coding conventions

- Prefer `async/await` over promise chains; handle errors gracefully.

## Agent DOs

- Use `this.register*` helpers for everything that needs cleanup.
  See [HOW_TO_REGISTER_LISTENERS_SAFELY.md](src/HOW_TO_REGISTER_LISTENERS_SAFELY.md)
- Use `this.logger` for debugging and informational messages to ensure they are visible in the plugin's log view.

## Agent DON'Ts

- **Do not modify `main.js` or `styles.css` directly**: These are compiled/bundled files. Always make changes in the
  `src/` directory.
	- JavaScript changes should be made in `src/*.ts`.
	- CSS changes should be made in `src/css/*.css`.
- **Do not use Notice** except for errors.

## Before finishing a task

- **Verify changes locally**: Run `npm run lint:fix && npm run test && npm run build` to ensure formatting/linting,
  tests, and bundling all succeed.
