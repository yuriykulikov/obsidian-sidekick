import type { AgentState, Note, TextHistoryEntry } from "./types";
import { type Logger, LogLevel } from "./utils/logger";

export type AgentPromptSections = {
  structureStr: string;
  contextStr: string;
  activityLogStr: string;
};

export function renderPromptSections(
  state: AgentState,
  logger: Logger,
): AgentPromptSections {
  const structureStr = renderDiscoveredNoteStructureSection(state, logger);
  const contextStr = renderNotesSection(state, logger);
  const activityLogStr = renderConversationAndActivityLog(state, logger);

  return {
    structureStr,
    contextStr,
    activityLogStr,
  };
}

export function renderNotesSection(state: AgentState, logger: Logger): string {
  if (state.notes.size === 0) return "";

  const notesMd = Array.from(state.notes.values())
    .map((note) => {
      const md = renderNoteToMarkdown(note);
      logger.markdown(
        `${note.content ? "Note content " : "Note structure "} ${note.filename}`,
        md,
        LogLevel.CONTEXT,
      );
      return md;
    })
    .join("\n");

  return `# Notes\n\n${notesMd}\n---\n`;
}

/**
 * Renders a list of paths as a markdown tree.
 */
export function renderDiscoveredStructure(paths: readonly string[]): string {
  if (paths.length === 0) {
    return "No structure discovered yet.";
  }

  interface TreeNode {
    [key: string]: TreeNode;
  }

  const sortedPaths = [...paths].sort();
  const root: TreeNode = {};

  for (const path of sortedPaths) {
    const parts = path.split("/");
    let current = root;
    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
  }

  let tree = "";
  const buildTree = (obj: TreeNode, indent = 0) => {
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      const child = obj[key];
      if (child) {
        const isFolder = Object.keys(child).length > 0;
        tree += `${"  ".repeat(indent) + (isFolder ? "- 📁 " : "- 📄 ") + key}\n`;
        buildTree(child, indent + 1);
      }
    }
  };

  buildTree(root);
  return tree.trim();
}

/**
 * Renders a note's context for the LLM.
 *
 * Kept outside `utils/notes.ts` because this is specifically prompt rendering
 * (LLM-facing) rather than note manipulation.
 */
export function renderNoteToMarkdown(note: Note): string {
  let noteHeader = note.filename;
  if (
    note.state?.originalFilename &&
    note.state.originalFilename !== note.filename
  ) {
    noteHeader = `${note.filename} (renamed from ${note.state.originalFilename})`;
  }
  let noteMd = `# ${noteHeader}\n`;

  noteMd += "## Metadata\n";
  noteMd += "```yaml\n";
  noteMd += `path: ${note.path.replace(/\.md$/, "")}\n`;
  const links = note.links || [];
  const backlinks = note.backlinks || [];

  const bidirectionalLinks = links.filter((l) => backlinks.includes(l));
  const uniqueLinks = links.filter((l) => !bidirectionalLinks.includes(l));
  const uniqueBacklinks = backlinks.filter(
    (b) => !bidirectionalLinks.includes(b),
  );

  noteMd += "bidirectional_links:\n";
  for (const l of bidirectionalLinks) {
    noteMd += `  - ${l}\n`;
  }

  noteMd += "links:\n";
  for (const l of uniqueLinks) {
    noteMd += `  - ${l}\n`;
  }

  noteMd += "backlinks:\n";
  for (const b of uniqueBacklinks) {
    noteMd += `  - ${b}\n`;
  }

  const tags = note.tags || [];
  noteMd += "tags:\n";
  for (const t of tags) {
    noteMd += `  - ${t}\n`;
  }

  if (note.frontmatter && Object.keys(note.frontmatter).length > 0) {
    noteMd += "properties:\n";
    for (const [key, value] of Object.entries(note.frontmatter)) {
      noteMd += `  ${key}: ${JSON.stringify(value)}\n`;
    }
  }

  noteMd += "```\n";

  const highlight = note.state?.highlight;
  if (highlight && highlight.trim().length > 0) {
    noteMd +=
      "## Highlighted text (subset of the note)\n" +
      "The user highlighted this exact excerpt. Prefer acting on this section; any edits/suggestions should apply within it.\n" +
      "```\n";
    noteMd += highlight.trim();
    noteMd += "\n```\n";
  }

  if (note.content) {
    noteMd += "## Content\n```\n";
    noteMd += note.content.trim();
    noteMd += "\n```\n";
  } else if (note.structure) {
    noteMd += "\n## Structure\n```\n";
    noteMd += note.structure.trim();
    noteMd += "\n```\n";
  } else {
    noteMd +=
      "\nOnly note metadata is available. Use tools to read the note text or note structure.\n";
  }
  return noteMd;
}

export function renderDiscoveredNoteStructureSection(
  state: AgentState,
  logger: Logger,
): string {
  if (state.discoveredStructure.length === 0) return "";

  const rendered = renderDiscoveredStructure(state.discoveredStructure);
  logger.markdown(
    "Discovered Vault Structure",
    `\`\`\`\n${rendered}\n\`\`\``,
    LogLevel.CONTEXT,
  );

  return `# Discovered Vault Structure\n\n\`\`\`\n${rendered}\n\`\`\`\n---\n`;
}

/**
 * Render a unified, chronological log interleaving user/agent messages with
 * tool calls and tool results.
 *
 * This is intentionally "AI-first": it preserves the timeline that led to
 * each tool invocation, helping the model avoid mixing tool outputs across
 * unrelated sub-threads.
 *
 * The most recent text entry is excluded because the latest user prompt is
 * appended separately at the end under "User Question".
 */
export function renderConversationAndActivityLog(
  state: AgentState,
  logger: Logger,
): string {
  const fullHistory = state.history;
  if (fullHistory.length === 0) return "";

  // Exclude last text entry (the latest prompt or latest agent message), to avoid duplication
  const lastTextIdx = (() => {
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      if (fullHistory[i]?.type === "text") return i;
    }
    return -1;
  })();

  const history =
    lastTextIdx >= 0
      ? [
          ...fullHistory.slice(0, lastTextIdx),
          ...fullHistory.slice(lastTextIdx + 1),
        ]
      : fullHistory;

  const rendered = history
    .map((h) => {
      if (h.type === "text") {
        const roleLabel = h.role === "user" ? "User prompt" : "Agent response";
        return `## ${roleLabel}\n${h.content}`;
      }

      if (h.type === "note_removed") {
        return `## User action\nRemoved note from context: ${h.filename}`;
      } else if (h.type === "notes_rollback") {
        const notesMd = Array.isArray(h.notes)
          ? `Rolled back changes in:\n${h.notes.map((n) => `- \`${n}\``).join("\n")}`
          : `Rolled back changes in: \`${h.notes}\``;
        return `## User action\n\n${notesMd}`;
      } else {
        const callArgs = JSON.stringify(h.call.args);
        const toolCall = `## Tool Call\n\`${h.call.name}(${callArgs})\``;
        const resultText = h.result.historyEntry();
        const toolResult = `### Tool Result\n${resultText}`;
        return `${toolCall}\n${toolResult}`;
      }
    })
    .join("\n");

  const logStr = `# Conversation & Activity Log\n${rendered}\n---\n`;
  logger.markdown("Conversation & activity log", logStr, LogLevel.CONTEXT);

  return logStr;
}

export function getLastUserPrompt(state: AgentState): string {
  const userEntries = state.history.filter(
    (h): h is TextHistoryEntry => h.type === "text" && h.role === "user",
  );
  const lastUserEntry = userEntries[userEntries.length - 1];
  return lastUserEntry ? lastUserEntry.content : "";
}
