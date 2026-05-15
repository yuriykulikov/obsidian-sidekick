import { describe, expect, it } from "vitest";
import { Pagination } from "./pagination";

const items = ["a", "b", "c", "d", "e"];

describe("Pagination", () => {
  it("uses defaults when params are missing", () => {
    const p = new Pagination({}, 30);
    expect(p.offset).toBe(0);
    expect(p.limit).toBe(30);
    expect(p.defaultOffset).toBe(0);
    expect(p.defaultLimit).toBe(30);
  });

  it("clamps negative offset to 0", () => {
    const p = new Pagination({ offset: -5 }, 30);
    expect(p.offset).toBe(0);
  });

  it("clamps limit to at least 1", () => {
    const p = new Pagination({ limit: 0 }, 30);
    expect(p.limit).toBe(1);
  });

  it("floors fractional values", () => {
    const p = new Pagination({ offset: 2.9, limit: 3.7 }, 30);
    expect(p.offset).toBe(2);
    expect(p.limit).toBe(3);
  });

  it("ignores non-finite values", () => {
    const p = new Pagination(
      { offset: Number.NaN, limit: Number.POSITIVE_INFINITY },
      10,
    );
    expect(p.offset).toBe(0);
    expect(p.limit).toBe(10);
  });
});

describe("Pagination.paginate", () => {
  it("returns the correct slice", () => {
    const p = new Pagination({ offset: 1, limit: 2 }, 30);
    const page = p.paginate(items);
    expect(page.items).toEqual(["b", "c"]);
  });

  it("returns all items when within limit", () => {
    const p = new Pagination({}, 30);
    const page = p.paginate(items);
    expect(page.items).toEqual(items);
  });

  it("returns empty items when offset is beyond end", () => {
    const p = new Pagination({ offset: 10 }, 30);
    const page = p.paginate(items);
    expect(page.items).toEqual([]);
  });
});

describe("Page", () => {
  it("computes total and omitted correctly", () => {
    const p = new Pagination({ offset: 0, limit: 3 }, 30);
    const page = p.paginate(items);
    expect(page.total).toBe(5);
    expect(page.omitted).toBe(2);
  });

  it("has zero omitted when page covers all items", () => {
    const p = new Pagination({}, 30);
    const page = p.paginate(items);
    expect(page.omitted).toBe(0);
  });
});

describe("Page.header", () => {
  it("shows range without omitted hint when nothing is omitted", () => {
    const p = new Pagination({ offset: 0, limit: 10 }, 10);
    const page = p.paginate(items);
    expect(page.header()).toBe("Showing 0..4 (5 notes).\n");
  });

  it("includes omitted hint when some results are truncated", () => {
    const p = new Pagination({ offset: 0, limit: 3 }, 3);
    const page = p.paginate(items);
    expect(page.header()).toContain("2 more result(s) omitted");
    expect(page.header()).toContain("offset=3 limit=3");
  });

  it("respects custom item label", () => {
    const p = new Pagination({}, 30);
    const page = p.paginate(items);
    expect(page.header("files")).toContain("5 files");
  });

  it("shows correct range when offset is mid-list", () => {
    const fourItems = ["a", "b", "c", "d"];
    const p = new Pagination({ offset: 2, limit: 2 }, 30);
    const page = p.paginate(fourItems);
    expect(page.header()).toBe("Showing 2..3 (2 notes).\n");
  });
});

describe("Page.suffix", () => {
  it("returns empty string for default paging with no omitted", () => {
    const p = new Pagination({}, 30);
    const page = p.paginate(items);
    expect(page.suffix()).toBe("");
  });

  it("includes omitted only when results are truncated and paging is default", () => {
    const p = new Pagination({ limit: 30 }, 30);
    const _page = p.paginate(
      ["x".repeat(31)].flatMap(() => items.concat(items).concat(items)),
    );
    // build a list longer than 30
    const longList = Array.from({ length: 35 }, (_, i) => `item${i}`);
    const page2 = new Pagination({}, 30).paginate(longList);
    expect(page2.suffix()).toBe(" (5 omitted)");
  });

  it("includes paging suffix when non-default offset is used", () => {
    const p = new Pagination({ offset: 5 }, 30);
    const page = p.paginate(items);
    expect(page.suffix()).toContain("offset=5");
  });

  it("includes paging suffix when non-default limit is used", () => {
    const p = new Pagination({ limit: 10 }, 30);
    const page = p.paginate(items);
    expect(page.suffix()).toContain("limit=10");
  });

  it("combines both suffixes", () => {
    const longList = Array.from({ length: 20 }, (_, i) => `item${i}`);
    const p = new Pagination({ offset: 5, limit: 5 }, 30);
    const page = p.paginate(longList);
    expect(page.suffix()).toBe(" (offset=5, limit=5) (10 omitted)");
  });
});
