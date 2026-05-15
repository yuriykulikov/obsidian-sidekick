const DEFAULT_OFFSET = 0;

/**
 * Holds a sliced page of results along with derived paging values.
 * Use `header()` and `suffix()` to build the standard output strings.
 */
export class Page<T> {
  readonly items: T[];
  readonly total: number;
  readonly omitted: number;

  private readonly shownStart: number;
  private readonly shownEndExclusive: number;
  private readonly offset: number;
  private readonly limit: number;
  private readonly defaultOffset: number;
  private readonly defaultLimit: number;

  constructor(
    allItems: T[],
    offset: number,
    limit: number,
    defaultOffset: number,
    defaultLimit: number,
  ) {
    this.offset = offset;
    this.limit = limit;
    this.defaultOffset = defaultOffset;
    this.defaultLimit = defaultLimit;

    this.total = allItems.length;
    this.items = allItems.slice(offset, offset + limit);
    this.shownStart = Math.min(offset, this.total);
    this.shownEndExclusive = Math.min(offset + limit, this.total);
    this.omitted = this.total - this.shownEndExclusive;
  }

  /**
   * Builds the "Showing X..Y (N <itemLabel>)." line, plus the
   * "N more result(s) omitted. Call again with offset=… limit=…." hint when applicable.
   */
  header(itemLabel = "notes"): string {
    let text = `Showing ${this.shownStart}..${this.shownEndExclusive - 1} (${this.items.length} ${itemLabel}).\n`;
    if (this.omitted > 0) {
      text += `Note: ${this.omitted} more result(s) omitted. Call again with offset=${this.shownEndExclusive} limit=${this.limit}.\n`;
    }
    return text;
  }

  /**
   * Builds the summary suffix for ToolResult titles:
   * "(offset=X, limit=Y)" when non-default paging is used, and/or "(N omitted)" when results are truncated.
   * Returns an empty string when both conditions are absent.
   */
  suffix(): string {
    const isDefaultPaging =
      this.offset === this.defaultOffset && this.limit === this.defaultLimit;
    const pagingSuffix = !isDefaultPaging
      ? ` (offset=${this.offset}, limit=${this.limit})`
      : "";
    const omittedSuffix = this.omitted > 0 ? ` (${this.omitted} omitted)` : "";
    return `${pagingSuffix}${omittedSuffix}`;
  }
}

/**
 * Parses and clamps `offset` and `limit` from raw tool params, then pages a result array via `paginate()`.
 */
export class Pagination {
  readonly offset: number;
  readonly limit: number;
  readonly defaultOffset = DEFAULT_OFFSET;
  readonly defaultLimit: number;

  constructor(params: Record<string, unknown>, defaultLimit: number) {
    this.defaultLimit = defaultLimit;
    this.offset = Number.isFinite(params.offset as number)
      ? Math.max(0, Math.floor(params.offset as number))
      : DEFAULT_OFFSET;
    this.limit = Number.isFinite(params.limit as number)
      ? Math.max(1, Math.floor(params.limit as number))
      : defaultLimit;
  }

  paginate<T>(items: T[]): Page<T> {
    return new Page(
      items,
      this.offset,
      this.limit,
      this.defaultOffset,
      this.defaultLimit,
    );
  }
}
