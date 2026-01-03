import { describe, it, expect } from "vitest";
import { fuzzyMatch } from "../fuzzy-match";

describe("fuzzyMatch", () => {
  describe("basic matching", () => {
    it("should return true for empty query", () => {
      expect(fuzzyMatch("hello world", "")).toBe(true);
    });

    it("should match exact string", () => {
      expect(fuzzyMatch("hello", "hello")).toBe(true);
    });

    it("should match partial string", () => {
      expect(fuzzyMatch("hello world", "hello")).toBe(true);
      expect(fuzzyMatch("hello world", "world")).toBe(true);
    });
  });

  describe("subsequence matching", () => {
    it("should match subsequence characters in order", () => {
      expect(fuzzyMatch("hello world", "hlo")).toBe(true);
      expect(fuzzyMatch("hello world", "hw")).toBe(true);
      expect(fuzzyMatch("hello world", "helloworld")).toBe(true);
    });

    it("should match non-contiguous characters", () => {
      expect(fuzzyMatch("abcdefg", "adg")).toBe(true);
      expect(fuzzyMatch("testing", "tsg")).toBe(true);
    });

    it("should match with spaces in query", () => {
      expect(fuzzyMatch("hello world", "hello world")).toBe(true);
      expect(fuzzyMatch("hello world", "lo wo")).toBe(true);
    });
  });

  describe("case insensitivity", () => {
    it("should be case insensitive for string", () => {
      expect(fuzzyMatch("Hello World", "hw")).toBe(true);
      expect(fuzzyMatch("HELLO", "hello")).toBe(true);
    });

    it("should be case insensitive for query", () => {
      expect(fuzzyMatch("hello world", "HW")).toBe(true);
      expect(fuzzyMatch("hello", "HELLO")).toBe(true);
    });

    it("should match mixed case", () => {
      expect(fuzzyMatch("HeLLo WoRLd", "HeWo")).toBe(true);
    });
  });

  describe("non-matching cases", () => {
    it("should return false for non-matching query", () => {
      expect(fuzzyMatch("hello", "xyz")).toBe(false);
    });

    it("should return false when characters are out of order", () => {
      expect(fuzzyMatch("hello", "leh")).toBe(false);
      expect(fuzzyMatch("hello", "olleh")).toBe(false);
    });

    it("should return false when query has more characters than available", () => {
      expect(fuzzyMatch("a", "aa")).toBe(false);
      expect(fuzzyMatch("hi", "hii")).toBe(false);
    });

    it("should return false for partial mismatch", () => {
      expect(fuzzyMatch("hello", "helloz")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string with empty query", () => {
      expect(fuzzyMatch("", "")).toBe(true);
    });

    it("should return false for empty string with non-empty query", () => {
      expect(fuzzyMatch("", "a")).toBe(false);
    });

    it("should handle single character strings", () => {
      expect(fuzzyMatch("a", "a")).toBe(true);
      expect(fuzzyMatch("a", "b")).toBe(false);
    });

    it("should handle special characters", () => {
      expect(fuzzyMatch("hello-world", "h-w")).toBe(true);
      expect(fuzzyMatch("hello_world", "hw")).toBe(true);
      expect(fuzzyMatch("file.tsx", "ftx")).toBe(true);
    });

    it("should handle unicode characters", () => {
      expect(fuzzyMatch("héllo wörld", "hw")).toBe(true);
    });

    it("should handle numbers", () => {
      expect(fuzzyMatch("test123", "t13")).toBe(true);
      expect(fuzzyMatch("123abc", "1a")).toBe(true);
    });
  });

  describe("real-world scenarios", () => {
    it("should match file paths", () => {
      expect(fuzzyMatch("src/components/Button.tsx", "scb")).toBe(true);
      expect(fuzzyMatch("src/components/Button.tsx", "button")).toBe(true);
      expect(fuzzyMatch("src/components/Button.tsx", "tsx")).toBe(true);
    });

    it("should match command names", () => {
      expect(fuzzyMatch("createNewTask", "cnt")).toBe(true);
      expect(fuzzyMatch("deleteAllItems", "dai")).toBe(true);
    });

    it("should match with typo-like queries", () => {
      expect(fuzzyMatch("settings", "stg")).toBe(true);
      expect(fuzzyMatch("preferences", "prf")).toBe(true);
    });
  });
});
