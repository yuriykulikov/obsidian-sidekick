import { describe, expect, it, vi } from "vitest";
import { matchesQuery, type SearchFileData } from "./search";

describe("matchesQuery", () => {
  const mockFile: SearchFileData = {
    basename: "Test Note",
    path: "Projects/Test Note.md",
    tags: ["#todo", "#work"],
    getContent: vi.fn().mockResolvedValue("This is a test note content."),
  };

  it("should match empty query", async () => {
    expect(await matchesQuery(mockFile, "")).toBe(true);
  });

  it("should match name:", async () => {
    expect(await matchesQuery(mockFile, "name:test")).toBe(true);
    expect(await matchesQuery(mockFile, "name:other")).toBe(false);
  });

  it("should match tag:", async () => {
    expect(await matchesQuery(mockFile, "tag:todo")).toBe(true);
    expect(await matchesQuery(mockFile, "tag:work")).toBe(true);
    expect(await matchesQuery(mockFile, "tag:done")).toBe(false);
  });

  it("should match path:", async () => {
    expect(await matchesQuery(mockFile, "path:projects")).toBe(true);
    expect(await matchesQuery(mockFile, "path:archive")).toBe(false);
  });

  it("should match full text", async () => {
    expect(await matchesQuery(mockFile, "content")).toBe(true);
    expect(await matchesQuery(mockFile, "absent")).toBe(false);
  });

  it("should match multiple terms (AND logic)", async () => {
    expect(await matchesQuery(mockFile, "name:test tag:todo")).toBe(true);
    expect(await matchesQuery(mockFile, "name:test tag:done")).toBe(false);
  });

  describe("negation (-)", () => {
    it("should negate name:", async () => {
      expect(await matchesQuery(mockFile, "-name:other")).toBe(true);
      expect(await matchesQuery(mockFile, "-name:test")).toBe(false);
    });

    it("should negate tag:", async () => {
      expect(await matchesQuery(mockFile, "-tag:done")).toBe(true);
      expect(await matchesQuery(mockFile, "-tag:todo")).toBe(false);
    });

    it("should negate path:", async () => {
      expect(await matchesQuery(mockFile, "-path:archive")).toBe(true);
      expect(await matchesQuery(mockFile, "-path:projects")).toBe(false);
    });

    it("should negate full text", async () => {
      expect(await matchesQuery(mockFile, "-absent")).toBe(true);
      expect(await matchesQuery(mockFile, "-content")).toBe(false);
    });

    it("should work with mixed terms", async () => {
      expect(await matchesQuery(mockFile, "name:test -tag:done")).toBe(true);
      expect(await matchesQuery(mockFile, "name:test -tag:todo")).toBe(false);
      expect(await matchesQuery(mockFile, "-name:other tag:work")).toBe(true);
    });

    it("should handle only minus sign gracefully", async () => {
      expect(await matchesQuery(mockFile, "-")).toBe(true);
    });
  });
});
