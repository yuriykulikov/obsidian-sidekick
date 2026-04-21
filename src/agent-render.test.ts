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
        links: ["other/Link1", "one/two/Link2", "one/two/Bidirectional"],
        backlinks: ["one/two/Backlink1", "one/two/Bidirectional"],
        tags: ["#tag1", "#tag2"],
        folderSiblings: ["Sibling1"],
      };

      const result = renderNoteToMarkdown(note);

      const expected = `# Test Note
## Metadata
\`\`\`yaml
path: one/two/Test Note
bidirectional_links:
  - one/two/Bidirectional
links:
  - other/Link1
  - one/two/Link2
backlinks:
  - one/two/Backlink1
tags:
  - #tag1
  - #tag2
\`\`\`
## Content
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
        parentPath: "one/two/three",
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
      const expected = `# Structured Note
## Metadata
\`\`\`yaml
path: one/two/three/Structured Note
bidirectional_links:
links:
backlinks:
tags:
\`\`\`

## Structure
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
        parentPath: "Deep/Path/To",
        content: "Empty",
        links: [],
        backlinks: [],
        tags: [],
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);
      const expected = `# Empty Note
## Metadata
\`\`\`yaml
path: Deep/Path/To/Empty Note
bidirectional_links:
links:
backlinks:
tags:
\`\`\`
## Content
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
        parentPath: "/",
        content: null,
        structure: null,
        links: [],
        backlinks: [],
        tags: [],
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);
      const expected = `# Meta Only Note
## Metadata
\`\`\`yaml
path: Meta Only Note
bidirectional_links:
links:
backlinks:
tags:
\`\`\`

Only note metadata is available. Use tools to read the note text or note structure.
`;
      expect(result).toBe(expected);
    });

    it("should render frontmatter properties in metadata", () => {
      const note: Note = {
        filename: "FM Note",
        path: "FM Note.md",
        parentPath: "/",
        content: "Hello",
        links: [],
        backlinks: [],
        tags: ["#test"],
        frontmatter: { status: "draft", priority: 1 },
        folderSiblings: [],
      };

      const result = renderNoteToMarkdown(note);
      const expected = `# FM Note
## Metadata
\`\`\`yaml
path: FM Note
bidirectional_links:
links:
backlinks:
tags:
  - #test
properties:
  status: "draft"
  priority: 1
\`\`\`
## Content
\`\`\`
Hello
\`\`\`
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
        `- 📁 folder
  - 📁 sub
    - 📄 note1.md
    - 📄 note2.md`,
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
        `- 📄 a.md
- 📄 b.md
- 📁 c
  - 📄 d.md`,
      );
    });
  });
});
