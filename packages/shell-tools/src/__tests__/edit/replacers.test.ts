import { describe, it, expect } from "vitest";
import {
  exactReplacer,
  lineTrimmedReplacer,
  indentationFlexibleReplacer,
  whitespaceNormalizedReplacer,
  blockAnchorReplacer,
  escapeNormalizedReplacer,
  findMatch,
} from "../../edit/replacers";

describe("replacers", () => {
  describe("exactReplacer", () => {
    it("should find exact matches", () => {
      const content = "hello world";
      const matches = [...exactReplacer(content, "world")];
      expect(matches).toEqual(["world"]);
    });

    it("should yield nothing when no match", () => {
      const content = "hello world";
      const matches = [...exactReplacer(content, "foo")];
      expect(matches).toEqual([]);
    });

    it("should find match at start", () => {
      const content = "hello world";
      const matches = [...exactReplacer(content, "hello")];
      expect(matches).toEqual(["hello"]);
    });

    it("should find multi-line exact match", () => {
      const content = "line1\nline2\nline3";
      const matches = [...exactReplacer(content, "line1\nline2")];
      expect(matches).toEqual(["line1\nline2"]);
    });
  });

  describe("lineTrimmedReplacer", () => {
    it("should match with trailing whitespace differences", () => {
      const content = "line 1   \nline 2\n";
      const matches = [...lineTrimmedReplacer(content, "line 1\nline 2")];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should return original content slice with trailing whitespace", () => {
      // Content has trailing whitespace on each line
      const content = "hello   \nworld   ";
      // Search without trailing whitespace
      const matches = [...lineTrimmedReplacer(content, "hello\nworld")];
      expect(matches.length).toBeGreaterThan(0);
      // Should return original with trailing whitespace intact
      expect(matches[0]).toBe("hello   \nworld   ");
    });

    it("should not match when content differs", () => {
      const content = "hello world";
      const matches = [...lineTrimmedReplacer(content, "goodbye world")];
      expect(matches).toEqual([]);
    });
  });

  describe("indentationFlexibleReplacer", () => {
    it("should match with different indentation levels", () => {
      const content = "    indented line\n    another line";
      const matches = [
        ...indentationFlexibleReplacer(content, "  indented line\n  another line"),
      ];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should return original content with original indentation", () => {
      const content = "    const x = 1;\n    return x;";
      const matches = [
        ...indentationFlexibleReplacer(content, "const x = 1;\nreturn x;"),
      ];
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toBe("    const x = 1;\n    return x;");
    });

    it("should handle empty lines", () => {
      const content = "  line1\n\n  line2";
      const matches = [
        ...indentationFlexibleReplacer(content, "line1\n\nline2"),
      ];
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("whitespaceNormalizedReplacer", () => {
    it("should match with collapsed whitespace", () => {
      const content = "hello    world";
      const matches = [...whitespaceNormalizedReplacer(content, "hello world")];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should match multiline to single line", () => {
      const content = "hello\nworld";
      const matches = [...whitespaceNormalizedReplacer(content, "hello world")];
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should not match empty find string", () => {
      const content = "hello world";
      const matches = [...whitespaceNormalizedReplacer(content, "")];
      expect(matches).toEqual([]);
    });

    it("should not match empty find string after normalization", () => {
      const content = "hello world";
      const matches = [...whitespaceNormalizedReplacer(content, "   ")];
      expect(matches).toEqual([]);
    });
  });

  describe("blockAnchorReplacer", () => {
    it("should match blocks with similar first/last lines", () => {
      const content = `function hello() {
  console.log("hi");
  return true;
}`;
      const find = `function hello() {
  // different middle
  return true;
}`;
      const matches = [...blockAnchorReplacer(content, find)];
      // Should find a match based on anchors
      expect(matches.length).toBeGreaterThan(0);
    });

    it("should require at least 2 lines", () => {
      const content = "single line content";
      const matches = [...blockAnchorReplacer(content, "single")];
      expect(matches).toEqual([]);
    });
  });

  describe("escapeNormalizedReplacer", () => {
    it("should match escaped newlines", () => {
      const content = "hello\nworld";
      const matches = [...escapeNormalizedReplacer(content, "hello\\nworld")];
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toBe("hello\nworld");
    });

    it("should match escaped tabs", () => {
      const content = "hello\tworld";
      const matches = [...escapeNormalizedReplacer(content, "hello\\tworld")];
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toBe("hello\tworld");
    });

    it("should not yield when no escaping needed", () => {
      const content = "hello world";
      const matches = [...escapeNormalizedReplacer(content, "hello world")];
      expect(matches).toEqual([]);
    });

    it("should match content with escaped characters", () => {
      const content = "hello\\nworld";
      const matches = [...escapeNormalizedReplacer(content, "hello\nworld")];
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("findMatch", () => {
    it("should find exact match first", () => {
      const result = findMatch("hello world", "world", false);
      expect(result).toEqual({ match: "world", occurrences: 1 });
    });

    it("should return null when no match", () => {
      const result = findMatch("hello world", "foo", false);
      expect(result).toBeNull();
    });

    it("should find match with replaceAll", () => {
      const result = findMatch("foo bar foo", "foo", true);
      expect(result).toEqual({ match: "foo", occurrences: 2 });
    });

    it("should return null for multiple matches without replaceAll", () => {
      const result = findMatch("foo bar foo", "foo", false);
      // Returns null because exact match finds multiple
      expect(result).toBeNull();
    });

    it("should try cascading strategies", () => {
      // Content has trailing whitespace
      const content = "hello world   ";
      // Search without trailing whitespace
      const result = findMatch(content, "hello world", false);
      expect(result).not.toBeNull();
      expect(result!.occurrences).toBe(1);
    });
  });
});
