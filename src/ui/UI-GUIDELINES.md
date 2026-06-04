# UI Development Guidelines

When writing or modifying UI code in Sidekick, follow these principles to ensure consistency, maintainability, and
readability.

## Functional Decomposition (Jetpack Compose-inspired)

We follow a Jetpack Compose-inspired approach where UI components are extracted into small, focused functions. This
makes the UI logic declarative and easy to follow.

### Key Principles

- **Extract Components**: Instead of building a massive DOM tree in a single method, break it down into smaller
  functions.
- **Top-Down Flow**: A parent function should call child functions to add specific sections of the UI.
- **Single Responsibility**: Each function should be responsible for rendering a specific part of the UI.

### Code Example

```typescript
export class ProjectView {
	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("sidekick-component-container");

		const header = container.createDiv({cls: "sidekick-component-header"});
		this.addHeaderButtons(header);

		const content = container.createDiv({cls: "sidekick-component-content"});
		await this.renderContent(content);
	}
}
```

## Semantic-CSS Naming Conventions

Follow a structured naming convention for CSS classes, as demonstrated in `src/css/project-view.css`. This ensures that
styles are scoped and their purpose is clear.

### Naming Rules

1. **Prefix**: Use `sidekick-` as a prefix for all custom classes.
2. **Hierarchy**: Use dashes to indicate the relationship between components and sub-components.
	- `.sidekick-[feature]-[component]-[sub-component]`
	- Example: `.sidekick-project-status-bar-item`
3. **State Modifiers**: Use the `.is-` prefix for classes that represent a state.
	- `.is-collapsed`, `.is-dragging`, `.is-active`, `.is-loading`.
4. **Clarity**: Names should describe the *purpose* of the element, not its appearance (e.g., `top-bar` instead of
   `gray-box`).

### Reference

Refer to `src/css/project-view.css` for a comprehensive example of these conventions in practice.
