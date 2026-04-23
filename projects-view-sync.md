### Plan: Bi-directional Sync for Projects View State

#### 1. Goal
Manage the state of the board view (specifically collapsed swimlanes) using `Projects.md` in the root of the vault.

#### 2. File Format (`Projects.md`)
The file will contain a section for collapsed swimlanes:
```markdown
# Collapsed

- bikes
- skis
```
This indicates that swimlanes corresponding to `#project/bikes` and `#project/skis` should be collapsed.

#### 3. Implementation Steps

##### A. State Management in `ProjectView`
- Add a set to keep track of collapsed swimlanes in `ProjectView`.
- Update `renderProjectArea` to load the state from `Projects.md` before rendering.

##### B. File Operations
- **Read**: Create a utility to parse `Projects.md`.
    - Locate `# Collapsed` section.
    - Extract list items.
- **Write**: Create a utility to update `Projects.md`.
    - If `# Collapsed` section exists, replace its content.
    - If not, append it.
    - Ensure the file is created if it doesn't exist.
- **Refresh**: Re-evaluate the file on every view refresh (manual reload or workspace change if applicable).

##### C. UI Enhancements
- Add a toggle (e.g., a chevron or a clickable heading) to each swimlane in `renderSwimlane`.
- When toggled:
    - Update the internal state.
    - Update the UI (hide/show the row).
    - Save the updated state to `Projects.md`.

##### D. Bi-directional Sync
- **UI -> File**: Toggling a swimlane in the UI triggers a write to `Projects.md`.
- **File -> UI**: 
    - On view refresh, read `Projects.md`.
    - Potentially listen for file changes in `Projects.md` to update the view automatically if the file is edited externally.

#### 4. Verification
- Manual verification:
    1. Open Projects view.
    2. Collapse a swimlane.
    3. Verify `Projects.md` is updated.
    4. Manually edit `Projects.md`.
    5. Refresh Projects view and verify it reflects the changes.
