export interface SearchFileData {
  basename: string;
  path: string;
  tags: string[];
  getContent: () => Promise<string>;
}

/**
 * Checks if a file matches the search query using a simple pseudo-language.
 * Supports:
 * - `name:filename` - Matches filename (basename)
 * - `tag:tagname` - Matches tags in metadata
 * - `path:folder/file` - Matches full file path
 * - `text` - Default full-text search in name, path, tags, and note content.
 * - `-term` - Negates the match for the term (e.g., `-tag:todo`, `-name:exclude`)
 * Multiple terms are combined using logical AND.
 * Case-insensitive.
 */
export async function matchesQuery(
  fileData: SearchFileData,
  query: string,
): Promise<boolean> {
  if (!query) return true;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return true;

  const lowerTags = fileData.tags.map((t) => t.toLowerCase());
  let content: string | null = null;

  for (const term of terms) {
    let matched = false;
    let isNegated = false;
    let effectiveTerm = term;

    if (term.startsWith("-")) {
      isNegated = true;
      effectiveTerm = term.substring(1);
      if (effectiveTerm.length === 0) continue; // Skip empty negation
    }

    if (effectiveTerm.startsWith("name:")) {
      const val = effectiveTerm.substring(5);
      matched = fileData.basename.toLowerCase().includes(val);
    } else if (effectiveTerm.startsWith("tag:")) {
      const val = effectiveTerm.substring(4);
      matched = lowerTags.some((t) => t.includes(val));
    } else if (effectiveTerm.startsWith("path:")) {
      const val = effectiveTerm.substring(5);
      matched = fileData.path.toLowerCase().includes(val);
    } else {
      // Full text search
      if (fileData.basename.toLowerCase().includes(effectiveTerm)) {
        matched = true;
      } else if (fileData.path.toLowerCase().includes(effectiveTerm)) {
        matched = true;
      } else if (lowerTags.some((t) => t.includes(effectiveTerm))) {
        matched = true;
      } else {
        if (content === null) {
          content = (await fileData.getContent()).toLowerCase();
        }
        if (content.includes(effectiveTerm)) {
          matched = true;
        }
      }
    }

    const finalMatch = isNegated ? !matched : matched;
    if (!finalMatch) return false;
  }

  return true;
}
