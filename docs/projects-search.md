# Projects Search

### Overview

Sidekick provides a search box in the Projects view to filter project notes using a simple pseudo-language.

### Features

- **Search Bar**: Integrated into the Projects view top bar.
- **Query Syntax**:
	- `name:` - matches filename.
	- `tag:` - matches metadata tags.
	- `path:` - matches file path.
	- `-term` - negates the match (e.g., `-tag:done`).
	- `text` (default) - full-text search across name, path, tags, and content.
- **Persistence**: Search queries are saved across sessions.
- **Debounced Updates**: The view re-renders automatically as you type (250ms debounce).

### Behavior

- **Re-rendering**: Uses a data-driven "Full Re-render" strategy for reliability and consistency.
- **Counters**: Swimlane counts reflect the filtered results, while the top status bar shows total project counts for
  the folder.
- **AND Logic**: Multiple terms are combined using logical AND.

### Design Note

We chose a **Full Re-render** approach over **DOM Visibility Toggling**. While re-rendering is slightly more expensive,
it is significantly simpler to maintain and ensures counters and state are always consistent with the data.
