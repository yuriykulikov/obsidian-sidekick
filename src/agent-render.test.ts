import { describe, expect, it } from "vitest";
import {
  renderDiscoveredStructure,
  renderNoteToMarkdown,
} from "./agent-render";
import type { Note } from "./types";

describe("agent-render", () => {
  describe("renderNoteToMarkdown", () => {
    it("should render a note with content correctly", () => {
      const note: Note = {
        filename: "Test Note",
        path: "one/two/Test Note.md",
        parentPath: "one/two",
        content: "This is the content of the note.",
        links: ["Link1", "Link2", "Bidirectional"],
        backlinks: ["Backlink1", "Bidirectional"],
        tags: ["#tag1", "#tag2"],
        folderSiblings: ["Sibling1"],
      };

      const result = renderNoteToMarkdown(note);

      const expected = `## Note [[Test Note]]
### Note metadata
\`\`\`yaml
path: one/two/Test Note.md
bidirectional_links:
  - [[Bidirectional]]
links:
  - [[Link1]]
  - [[Link2]]
backlinks:
  - [[Backlink1]]
\`\`\`
### Content
\`\`\`
This is the content of the note.
\`\`\`
`;
      expect(result).toBe(expected);
    });

    it("should render a note with structure correctly", () => {
      const note: Note = {
        filename: "Structured Note",
        path: "one/two/three/Structured Note.md",
        content: null,
        structure: `
# Header 1
## Header 2
`.trim(),
        links: [],
        backlinks: [],
        tags: [],
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);

      const expected = `## Note [[Structured Note]]
### Note metadata
\`\`\`yaml
path: one/two/three/Structured Note.md
bidirectional_links:
links:
backlinks:
\`\`\`

### Structure
\`\`\`
# Header 1
## Header 2
\`\`\`
`;
      expect(result).toBe(expected);
    });

    it("should handle empty links and backlinks", () => {
      const note: Note = {
        filename: "Empty Note",
        path: "Deep/Path/To/Empty Note.md",
        content: "Empty",
        links: [],
        backlinks: [],
        tags: [],
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);
      const expected = `## Note [[Empty Note]]
### Note metadata
\`\`\`yaml
path: Deep/Path/To/Empty Note.md
bidirectional_links:
links:
backlinks:
\`\`\`
### Content
\`\`\`
Empty
\`\`\`
`;
      expect(result).toBe(expected);
    });

    it("should render a message when both content and structure are missing", () => {
      const note: Note = {
        filename: "Meta Only Note",
        path: "Meta Only Note.md",
        content: null,
        structure: null,
        links: [],
        backlinks: [],
        tags: [],
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);
      const expected = `## Note [[Meta Only Note]]
### Note metadata
\`\`\`yaml
path: Meta Only Note.md
bidirectional_links:
links:
backlinks:
\`\`\`

Only note metadata is available. Use tools to read the note text or note structure.
`;
      expect(result).toBe(expected);
    });
  });
  describe("renderDiscoveredStructure", () => {
    it("should return a message when no paths are provided", () => {
      expect(renderDiscoveredStructure([])).toBe(
        "No structure discovered yet.",
      );
    });

    it("should render a simple file list as a tree", () => {
      const paths = ["folder/sub/note1.md", "folder/sub/note2.md"];
      const result = renderDiscoveredStructure(paths);
      expect(result).toBe(
        `
- 📁 folder
  - 📁 sub
    - 📄 note1.md
    - 📄 note2.md
`.trim(),
      );
    });

    it("should render nested folders and files correctly", () => {
      const paths = [
        "folder1/note1.md",
        "folder1/subfolder/note2.md",
        "folder2/note3.md",
        "root-note.md",
      ];
      const result = renderDiscoveredStructure(paths);

      const expected = `- 📁 folder1
  - 📄 note1.md
  - 📁 subfolder
    - 📄 note2.md
- 📁 folder2
  - 📄 note3.md
- 📄 root-note.md`;

      expect(result).toBe(expected);
    });

    it("should sort paths alphabetically", () => {
      const paths = ["b.md", "a.md", "c/d.md"];
      const result = renderDiscoveredStructure(paths);
      expect(result).toBe(
        `
- 📄 a.md
- 📄 b.md
- 📁 c
  - 📄 d.md
`.trim(),
      );
    });
  });
});
