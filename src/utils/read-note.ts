import { type App, TFile } from "obsidian";
import type { Note } from "../types";

/**
 * Reads a note's content, links, and backlinks.
 */
export async function readNote(
  app: App,
  file: TFile,
  detail: "metadata" | "structure" | "text",
): Promise<Note> {
  const filename = file.basename;
  const content = (await app.vault.read(file)) || "";

  const links: string[] = [];
  const backlinks: string[] = [];
  const tags: string[] = [];

  const cache = app.metadataCache.getFileCache(file);
  if (cache?.links) {
    for (const link of cache.links) {
      const dest = app.metadataCache.getFirstLinkpathDest(link.link, file.path);
      if (dest) {
        const parentPath = dest.parent?.path;
        const displayPath =
          parentPath && parentPath !== "/" && parentPath !== ""
            ? `${parentPath}/${dest.basename}`
            : dest.basename;
        links.push(displayPath);
      } else {
        links.push(link.link);
      }
    }
  }

  if (cache?.tags) {
    for (const tag of cache.tags) {
      tags.push(tag.tag);
    }
  }

  if (cache?.frontmatter?.tags) {
    const fmTags = cache.frontmatter.tags;
    if (Array.isArray(fmTags)) {
      for (const tag of fmTags) {
        tags.push(
          typeof tag === "string" && !tag.startsWith("#") ? `#${tag}` : tag,
        );
      }
    } else if (typeof fmTags === "string") {
      for (const tag of fmTags.split(/[\s,]+/)) {
        if (tag) {
          tags.push(tag.startsWith("#") ? tag : `#${tag}`);
        }
      }
    }
  }

  const resolvedLinks = app.metadataCache.resolvedLinks;
  for (const [sourcePath, targets] of Object.entries(resolvedLinks)) {
    if (targets[file.path]) {
      const sourceFile = app.vault.getAbstractFileByPath(sourcePath);
      if (sourceFile instanceof TFile) {
        const parentPath = sourceFile.parent?.path;
        const displayPath =
          parentPath && parentPath !== "/" && parentPath !== ""
            ? `${parentPath}/${sourceFile.basename}`
            : sourceFile.basename;
        backlinks.push(displayPath);
      }
    }
  }

  const structure = content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (
        trimmed.startsWith("# ") ||
        trimmed.startsWith("## ") ||
        trimmed.startsWith("### ")
      ) {
        return trimmed;
      }
      const linksFound = extractLinks(trimmed);
      if (linksFound.length > 0) {
        return `Links: ${linksFound.join(", ")}`;
      }
      return null;
    })
    .filter((line): line is string => line !== null);

  const parentFolder = file.parent;
  let folderSiblings: string[] = [];
  if (parentFolder) {
    folderSiblings = parentFolder.children
      .filter(
        (child) =>
          child instanceof TFile &&
          child.extension === "md" &&
          child.path !== file.path,
      )
      .map((child) => (child as TFile).basename);
  }

  // Extract frontmatter properties (excluding internal keys and tags, which are handled separately)
  let frontmatter: Record<string, unknown> | null = null;
  if (cache?.frontmatter) {
    const { position, tags: _tags, ...rest } = cache.frontmatter;
    if (Object.keys(rest).length > 0) {
      frontmatter = rest;
    }
  }

  const structureOrText = detail === "structure" || detail === "text";
  return {
    filename: filename,
    path: file.path,
    content: detail === "text" ? content : null,
    links: [...new Set(links)],
    backlinks: [...new Set(backlinks)],
    tags: [...new Set(tags)],
    frontmatter,
    structure: structureOrText ? structure.join("\n") : null,
    parentPath: parentFolder?.path || "/",
    folderSiblings: structureOrText ? folderSiblings : null,
  };
}

/**
 * Extracts Obsidian links from a string.
 */
export function extractLinks(text: string): string[] {
  if (!text.includes("[[")) {
    return [];
  }
  const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?]]/g;
  const linksFound: string[] = [];
  const matches = text.matchAll(linkRegex);
  for (const match of matches) {
    const basename = match[1]?.trim();
    if (basename) {
      linksFound.push(basename);
    }
  }
  return linksFound;
}
