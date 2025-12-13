import { describe, it, expect } from "vitest";
import {
  detectLineEnding,
  normalizeLineEndings,
  restoreLineEndings,
  safeLiteralReplace,
  safeLiteralReplaceAll,
  countOccurrences,
  levenshteinDistance,
  similarity,
} from "../../edit/utils";

describe("utils", () => {
  describe("detectLineEnding", () => {
    it("should detect CRLF as dominant", () => {
      const content = "line1\r\nline2\r\nline3";
      expect(detectLineEnding(content)).toBe("\r\n");
    });

    it("should detect LF as dominant", () => {
      const content = "line1\nline2\nline3";
      expect(detectLineEnding(content)).toBe("\n");
    });

    it("should detect majority line ending", () => {
      // More CRLF than LF
      const content = "line1\r\nline2\r\nline3\n";
      expect(detectLineEnding(content)).toBe("\r\n");
    });

    it("should default to LF for empty content", () => {
      expect(detectLineEnding("")).toBe("\n");
    });

    it("should default to LF for content without line endings", () => {
      expect(detectLineEnding("single line")).toBe("\n");
    });
  });

  describe("normalizeLineEndings", () => {
    it("should convert CRLF to LF", () => {
      const content = "line1\r\nline2\r\nline3";
      expect(normalizeLineEndings(content)).toBe("line1\nline2\nline3");
    });

    it("should leave LF unchanged", () => {
      const content = "line1\nline2\nline3";
      expect(normalizeLineEndings(content)).toBe("line1\nline2\nline3");
    });

    it("should handle mixed line endings", () => {
      const content = "line1\r\nline2\nline3\r\n";
      expect(normalizeLineEndings(content)).toBe("line1\nline2\nline3\n");
    });
  });

  describe("restoreLineEndings", () => {
    it("should convert LF to CRLF", () => {
      const content = "line1\nline2\nline3";
      expect(restoreLineEndings(content, "\r\n")).toBe("line1\r\nline2\r\nline3");
    });

    it("should leave LF unchanged when LF is target", () => {
      const content = "line1\nline2\nline3";
      expect(restoreLineEndings(content, "\n")).toBe("line1\nline2\nline3");
    });
  });

  describe("safeLiteralReplace", () => {
    it("should replace first occurrence", () => {
      expect(safeLiteralReplace("foo bar foo", "foo", "baz")).toBe("baz bar foo");
    });

    it("should handle $ in replacement", () => {
      expect(safeLiteralReplace("hello", "hello", "$1 $& $`")).toBe("$1 $& $`");
    });

    it("should return original when no match", () => {
      expect(safeLiteralReplace("hello", "world", "test")).toBe("hello");
    });

    it("should handle empty search", () => {
      expect(safeLiteralReplace("hello", "", "test")).toBe("hello");
    });
  });

  describe("safeLiteralReplaceAll", () => {
    it("should replace all occurrences", () => {
      expect(safeLiteralReplaceAll("foo bar foo", "foo", "baz")).toBe(
        "baz bar baz"
      );
    });

    it("should handle $ in replacement", () => {
      expect(safeLiteralReplaceAll("a a", "a", "$1")).toBe("$1 $1");
    });

    it("should return original when no match", () => {
      expect(safeLiteralReplaceAll("hello", "world", "test")).toBe("hello");
    });

    it("should handle empty search", () => {
      expect(safeLiteralReplaceAll("hello", "", "test")).toBe("hello");
    });

    it("should handle adjacent matches", () => {
      expect(safeLiteralReplaceAll("aaa", "a", "b")).toBe("bbb");
    });
  });

  describe("countOccurrences", () => {
    it("should count single occurrence", () => {
      expect(countOccurrences("hello world", "world")).toBe(1);
    });

    it("should count multiple occurrences", () => {
      expect(countOccurrences("foo bar foo baz foo", "foo")).toBe(3);
    });

    it("should return 0 for no match", () => {
      expect(countOccurrences("hello world", "xyz")).toBe(0);
    });

    it("should return 0 for empty search", () => {
      expect(countOccurrences("hello", "")).toBe(0);
    });

    it("should not count overlapping matches", () => {
      expect(countOccurrences("aaa", "aa")).toBe(1);
    });
  });

  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("should return length for empty vs non-empty", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
      expect(levenshteinDistance("hello", "")).toBe(5);
    });

    it("should return 0 for two empty strings", () => {
      expect(levenshteinDistance("", "")).toBe(0);
    });

    it("should calculate single character difference", () => {
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
    });

    it("should calculate insertion distance", () => {
      expect(levenshteinDistance("helo", "hello")).toBe(1);
    });

    it("should calculate deletion distance", () => {
      expect(levenshteinDistance("hello", "helo")).toBe(1);
    });

    it("should handle complete difference", () => {
      expect(levenshteinDistance("abc", "xyz")).toBe(3);
    });
  });

  describe("similarity", () => {
    it("should return 1 for identical strings", () => {
      expect(similarity("hello", "hello")).toBe(1);
    });

    it("should return 1 for two empty strings", () => {
      expect(similarity("", "")).toBe(1);
    });

    it("should return 0 for empty vs non-empty", () => {
      expect(similarity("", "hello")).toBe(0);
    });

    it("should return high similarity for similar strings", () => {
      expect(similarity("hello", "hallo")).toBeGreaterThan(0.7);
    });

    it("should return low similarity for different strings", () => {
      expect(similarity("abc", "xyz")).toBeLessThan(0.3);
    });
  });
});
