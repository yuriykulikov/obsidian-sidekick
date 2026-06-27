import { describe, expect, it, vi } from "vitest";
import {
  renderDiscoveredStructure,
  renderNoteToMarkdown,
  renderPromptSections,
} from "./agent-render";
import { AgentState, type Note } from "./types";
import type { Logger } from "./utils/logger";

describe("agent-render", () => {
  const mockLogger = {
    markdown: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    user: vi.fn(),
    loop: vi.fn(),
    tool: vi.fn(),
    getLogs: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    clear: vi.fn(),
  } as unknown as Logger;

  describe("renderPromptSections", () => {
    it("should render full prompt with all sections", () => {
      const state = new AgentState(
        [
          { type: "text", role: "user", content: "Hello agent" },
          { type: "text", role: "model", content: "Hello user" },
          { type: "text", role: "user", content: "Latest question" },
        ],
        new Map([
          [
            "test.md",
            {
              filename: "test",
              path: "test.md",
              content: "Note content",
              links: [],
              backlinks: [],
              tags: [],
              isInstruction: false,
            } as Note,
          ],
        ]),
        false,
      );

      const agentsContent = "Custom agent instructions";
      const result = renderPromptSections(state, mockLogger, agentsContent);

      const expected = `# AGENTS.md
You have access **AGENTS.md**: The primary instruction file in the vault root. Its content is automatically included in your session prompt.
[!IMPORTANT]
> This content is already pre-loaded into your context. There is no need to use \`read_note\` to read AGENTS.md.

## Progressive disclosure of instructions

You can follow links from this file to access additional instruction files:
- If a task relates to a topic mentioned in AGENTS.md, follow that link.
- Only load linked files when directly relevant to the user's request.

## Modifying Instructions (AGENTS.md & linked files)

You are encouraged to evolve your instructions to stay aligned with the user's workflow.

- **Explicit Command**: If the user asks you to remember something or change your instructions/guidelines, use \`edit-note\` to modify AGENTS.md immediately.
- **Task Notes**: For other edits (task-related notes), use \`edit-note\` on the target note.
- **Discovery**: If you discover latent guidelines, structures, or workflows (e.g., via \`read-note\`) that are not yet documented, **ask the user** if you should add them to your instructions.
- **Organization**: Keep AGENTS.md concise and high-level. Suggest moving detailed instructions to new or existing linked files to avoid context bloat.

## Content of AGENTS.md
\`\`\`
Custom agent instructions
\`\`\`

---

# Discovered Vault Structure

This structure shows notes paths which are loaded in the context and is a subset of all notes in the vault.

\`\`\`
- 📄 test.md
\`\`\`

---
# Notes

# test
## Metadata
\`\`\`yaml
path: test
bidirectional_links:
links:
backlinks:
tags:
\`\`\`
## Content
\`\`\`
Note content
\`\`\`


---
# Conversation & Activity Log
## User prompt
Hello agent
## Agent response
Hello user

---

# User Question
Latest question`;

      expect(result).toBe(expected);
      expect(mockLogger.markdown).toHaveBeenCalledWith(
        "AGENTS.md",
        expect.stringContaining("# AGENTS.md"),
        "CONTEXT",
      );

      // Verify "Latest question" is NOT in the Conversation Log because it's the last user prompt
      const conversationLogPart = result.split("# User Question")[0];
      expect(conversationLogPart).not.toContain("Latest question");
    });

    it("should handle missing agentsContent", () => {
      const state = new AgentState(
        [{ type: "text", role: "user", content: "Only question" }],
        new Map(),
        false,
      );

      const result = renderPromptSections(state, mockLogger);

      const expected = `# AGENTS.md
You have access **AGENTS.md**: The primary instruction file in the vault root. Its content is automatically included in your session prompt.
[!IMPORTANT]
> This content is already pre-loaded into your context. There is no need to use \`read_note\` to read AGENTS.md.

## Progressive disclosure of instructions

You can follow links from this file to access additional instruction files:
- If a task relates to a topic mentioned in AGENTS.md, follow that link.
- Only load linked files when directly relevant to the user's request.

## Modifying Instructions (AGENTS.md & linked files)

You are encouraged to evolve your instructions to stay aligned with the user's workflow.

- **Explicit Command**: If the user asks you to remember something or change your instructions/guidelines, use \`edit-note\` to modify AGENTS.md immediately.
- **Task Notes**: For other edits (task-related notes), use \`edit-note\` on the target note.
- **Discovery**: If you discover latent guidelines, structures, or workflows (e.g., via \`read-note\`) that are not yet documented, **ask the user** if you should add them to your instructions.
- **Organization**: Keep AGENTS.md concise and high-level. Suggest moving detailed instructions to new or existing linked files to avoid context bloat.

## Content of AGENTS.md
\`\`\`

AGENTS.md is missing from the vault root.
Having an AGENTS.md file helps you stay aligned with the user's long-term objectives and project-specific conventions.
You should suggest to the user that they create one, or offer to initialize it for them with some initial content based on your current understanding of the vault.

\`\`\`

---

# Conversation & Activity Log


---

# User Question
Only question`;

      expect(result).toBe(expected);
    });
  });

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
        isInstruction: false,
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
        isInstruction: false,
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
        isInstruction: false,
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
        isInstruction: false,
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

    it("should render open in editor status correctly", () => {
      const note: Note = {
        filename: "Active Note",
        path: "Active Note.md",
        content: "Active content",
        links: [],
        backlinks: [],
        tags: [],
        isInstruction: false,
        state: {
          active: true,
        },
      };

      const result = renderNoteToMarkdown(note);
      expect(result).toContain(
        "# Active Note (currently open in the editor; visible to the user)",
      );
      expect(result).toContain("is_open_in_editor: true");
    });

    it("should render renamed and open in editor status correctly", () => {
      const note: Note = {
        filename: "New Name",
        path: "New Name.md",
        content: "Content",
        links: [],
        backlinks: [],
        tags: [],
        isInstruction: false,
        state: {
          active: true,
          originalFilename: "Old Name",
        },
      };

      const result = renderNoteToMarkdown(note);
      expect(result).toContain(
        "# New Name (renamed from Old Name, currently open in the editor; visible to the user)",
      );
      expect(result).toContain("is_open_in_editor: true");
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
        isInstruction: false,
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
