import { describe, it, expect } from "vitest";
import { grep, GrepInputSchema, GrepOutputSchema } from "../grep";
import { join } from "path";
import { ZodError } from "zod";
import { utimes } from "fs/promises";

const fixturesPath = join(__dirname, "fixtures");

describe("grep", () => {
  it("should find matches in a file", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    expect(result.metadata.matches).toBeGreaterThan(0);
    expect(result.output).toContain("Hello");
  });

  it("should return formatted output with line numbers", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    expect(result.output).toContain("Line ");
    expect(result.output).toContain("sample.txt:");
  });

  it("should search in directories", async () => {
    const result = await grep({
      pattern: "greet",
      path: fixturesPath,
    });

    expect(result.metadata.matches).toBeGreaterThan(0);
    expect(result.output).toContain("code.ts");
  });

  it("should support glob patterns via include", async () => {
    const result = await grep({
      pattern: "Hello",
      path: fixturesPath,
      include: "*.txt",
    });

    expect(result.metadata.matches).toBeGreaterThan(0);
    expect(result.output).toContain(".txt");
    expect(result.output).not.toContain(".ts:");
  });

  it("should return no matches when pattern not found", async () => {
    const result = await grep({
      pattern: "nonexistent_pattern_xyz",
      path: fixturesPath,
    });

    expect(result.metadata.matches).toBe(0);
    expect(result.output).toBe("No files found");
  });

  it("should support regex patterns", async () => {
    const result = await grep({
      pattern: "greet|farewell",
      path: join(fixturesPath, "code.ts"),
    });

    expect(result.metadata.matches).toBeGreaterThan(0);
  });

  it("should validate output matches GrepOutputSchema", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    // Output should be valid according to schema
    const parsed = GrepOutputSchema.parse(result);
    expect(parsed).toEqual(result);
  });

  it("should set title to the pattern", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    expect(result.title).toBe("Hello");
  });

  it("should indicate when results are truncated", async () => {
    // This test assumes we have enough matches to trigger truncation
    // For now, just verify the truncated field exists
    const result = await grep({
      pattern: ".",
      path: fixturesPath,
    });

    expect(typeof result.metadata.truncated).toBe("boolean");
  });

  it("should be case-sensitive by default", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    // sample.txt has "Hello", "hello", and "HELLO"
    // Case-sensitive search should only match "Hello"
    expect(result.output).toContain("Hello");
    expect(result.output).not.toMatch(/Line \d+:.*hello lowercase/);
    expect(result.output).not.toMatch(/Line \d+:.*HELLO UPPERCASE/);
  });

  it("should truncate lines longer than 2000 characters", async () => {
    const result = await grep({
      pattern: "END_MARKER",
      path: join(fixturesPath, "long-line.txt"),
    });

    expect(result.metadata.matches).toBe(1);
    // The line should be truncated and end with "..."
    expect(result.output).toContain("...");
    // The END_MARKER should not appear because it's at the end of the long line
    expect(result.output).not.toContain("END_MARKER");
  });

  it("should truncate results when exceeding 100 matches", async () => {
    const result = await grep({
      pattern: "match line",
      path: join(fixturesPath, "many-matches.txt"),
    });

    // many-matches.txt has 150 lines, should be truncated to 100
    expect(result.metadata.matches).toBe(100);
    expect(result.metadata.truncated).toBe(true);
    expect(result.output).toContain("Results are truncated");
  });

  it("should throw on invalid regex pattern", async () => {
    await expect(
      grep({
        pattern: "[invalid",
        path: fixturesPath,
      })
    ).rejects.toThrow();
  });

  it("should throw on non-existent path", async () => {
    await expect(
      grep({
        pattern: "test",
        path: "/nonexistent/path/that/does/not/exist",
      })
    ).rejects.toThrow();
  });

  it("should handle files with pipe characters in content", async () => {
    const result = await grep({
      pattern: "pipe",
      path: join(fixturesPath, "pipe-content.txt"),
    });

    expect(result.metadata.matches).toBeGreaterThan(0);
    // Verify the full line content is preserved including pipes
    expect(result.output).toContain("single | pipe");
    expect(result.output).toContain("multiple | pipe | characters");
  });

  it("should return results sorted by modification time (most recent first)", async () => {
    // Touch sample.txt to make it the most recently modified
    const samplePath = join(fixturesPath, "sample.txt");
    const codePath = join(fixturesPath, "code.ts");

    // Set code.ts to be older
    const pastTime = new Date(Date.now() - 10000);
    await utimes(codePath, pastTime, pastTime);

    // Set sample.txt to be newer
    const nowTime = new Date();
    await utimes(samplePath, nowTime, nowTime);

    const result = await grep({
      pattern: "Hello",
      path: fixturesPath,
    });

    // Both files contain "Hello", sample.txt should appear first
    const sampleIndex = result.output.indexOf("sample.txt");
    const codeIndex = result.output.indexOf("code.ts");

    expect(sampleIndex).toBeGreaterThan(-1);
    expect(codeIndex).toBeGreaterThan(-1);
    expect(sampleIndex).toBeLessThan(codeIndex);
  });

  it("should handle special regex characters", async () => {
    // Search for literal dot
    const dotResult = await grep({
      pattern: "special\\.dot",
      path: join(fixturesPath, "special-chars.txt"),
    });
    expect(dotResult.metadata.matches).toBe(1);
    expect(dotResult.output).toContain("special.dot");

    // Search for square brackets
    const bracketResult = await grep({
      pattern: "\\[brackets\\]",
      path: join(fixturesPath, "special-chars.txt"),
    });
    expect(bracketResult.metadata.matches).toBe(1);
    expect(bracketResult.output).toContain("[brackets]");

    // Search for parentheses
    const parenResult = await grep({
      pattern: "\\(round\\)",
      path: join(fixturesPath, "special-chars.txt"),
    });
    expect(parenResult.metadata.matches).toBe(1);
    expect(parenResult.output).toContain("(round)");
  });

  it("should handle commands with pipe characters (shell injection safety)", async () => {
    const result = await grep({
      pattern: "grep pattern | head",
      path: join(fixturesPath, "pipe-content.txt"),
    });

    // This should search for the literal string, not execute shell commands
    expect(result.metadata.matches).toBe(1);
    expect(result.output).toContain("grep pattern | head");
  });
});

describe("GrepInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      pattern: "test",
      path: "/some/path",
      include: "*.ts",
    };

    expect(() => GrepInputSchema.parse(input)).not.toThrow();
  });

  it("should require pattern", () => {
    expect(() => GrepInputSchema.parse({})).toThrow(ZodError);
  });

  it("should require path", () => {
    expect(() => GrepInputSchema.parse({ pattern: "test" })).toThrow(ZodError);
  });

  it("should allow optional include", () => {
    expect(() =>
      GrepInputSchema.parse({ pattern: "test", path: "/path" })
    ).not.toThrow();
  });

  it("should throw on empty string pattern", async () => {
    await expect(
      grep({ pattern: "", path: fixturesPath })
    ).rejects.toThrow("pattern is required");
  });
});
