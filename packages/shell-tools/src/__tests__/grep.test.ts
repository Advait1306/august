import { describe, it, expect } from "vitest";
import { grep, GrepInputSchema, GrepOutputSchema } from "../grep";
import { join } from "path";
import { ZodError } from "zod";

const fixturesPath = join(__dirname, "fixtures");

describe("grep", () => {
  it("should find matches in a file", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
    });

    expect(result.exitCode).toBe(0);
    expect(result.matches.length).toBe(2);
    expect(result.matches[0]?.text).toContain("Hello");
  });

  it("should return line numbers", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
      lineNumbers: true,
    });

    expect(result.matches[0]?.lineNumber).toBe(1);
    expect(result.matches[1]?.lineNumber).toBe(3);
  });

  it("should support case insensitive search", async () => {
    const result = await grep({
      pattern: "hello",
      path: join(fixturesPath, "sample.txt"),
      ignoreCase: true,
    });

    expect(result.matches.length).toBe(4);
  });

  it("should search in directories", async () => {
    const result = await grep({
      pattern: "greet",
      path: fixturesPath,
    });

    expect(result.exitCode).toBe(0);
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0]?.path).toContain("code.ts");
  });

  it("should support glob patterns", async () => {
    const result = await grep({
      pattern: "Hello",
      path: fixturesPath,
      glob: "*.txt",
    });

    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.every((m) => m.path.endsWith(".txt"))).toBe(true);
  });

  it("should respect maxCount option", async () => {
    const result = await grep({
      pattern: "Hello",
      path: join(fixturesPath, "sample.txt"),
      ignoreCase: true,
      maxCount: 2,
    });

    expect(result.matches.length).toBe(2);
  });

  it("should return empty matches when pattern not found", async () => {
    const result = await grep({
      pattern: "nonexistent_pattern_xyz",
      path: fixturesPath,
    });

    expect(result.matches.length).toBe(0);
    expect(result.exitCode).toBe(1); // ripgrep returns 1 when no matches
  });

  it("should support regex patterns", async () => {
    const result = await grep({
      pattern: "greet|farewell",
      path: join(fixturesPath, "code.ts"),
    });

    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("should throw ZodError for invalid input", async () => {
    await expect(
      grep({
        pattern: "",
        path: "",
        maxCount: -1, // Invalid: must be positive
      })
    ).rejects.toThrow(ZodError);
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
});

describe("GrepInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      pattern: "test",
      path: "/some/path",
      ignoreCase: true,
      maxCount: 10,
    };

    expect(() => GrepInputSchema.parse(input)).not.toThrow();
  });

  it("should require pattern and path", () => {
    expect(() => GrepInputSchema.parse({})).toThrow(ZodError);
    expect(() => GrepInputSchema.parse({ pattern: "test" })).toThrow(ZodError);
    expect(() => GrepInputSchema.parse({ path: "/path" })).toThrow(ZodError);
  });

  it("should reject invalid maxCount", () => {
    expect(() =>
      GrepInputSchema.parse({
        pattern: "test",
        path: "/path",
        maxCount: 0, // Must be positive
      })
    ).toThrow(ZodError);

    expect(() =>
      GrepInputSchema.parse({
        pattern: "test",
        path: "/path",
        maxCount: -5, // Must be positive
      })
    ).toThrow(ZodError);
  });

  it("should reject negative context lines", () => {
    expect(() =>
      GrepInputSchema.parse({
        pattern: "test",
        path: "/path",
        before: -1,
      })
    ).toThrow(ZodError);
  });
});
