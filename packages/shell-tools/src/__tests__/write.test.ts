import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  write,
  WriteInputSchema,
  WriteOutputSchema,
  WriteError,
  WriteErrorType,
} from "../write";
import { join } from "path";
import { mkdir, writeFile, rm, readFile, stat } from "fs/promises";

const fixturesPath = join(__dirname, "fixtures-write-test");

// Create fixtures directory before tests run
beforeAll(async () => {
  await mkdir(fixturesPath, { recursive: true });
});

// Clean up fixtures after tests complete
afterAll(async () => {
  await rm(fixturesPath, { recursive: true, force: true });
});

// Helper to create a test file
async function createTestFile(name: string, content: string): Promise<string> {
  const filePath = join(fixturesPath, name);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

// Helper to read a test file
async function readTestFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

// Helper to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

describe("write", () => {
  describe("creating new files", () => {
    it("should create a new file with content", async () => {
      const filePath = join(fixturesPath, "new-file.txt");
      const result = await write({
        filePath,
        content: "hello world",
      });

      expect(result.metadata.created).toBe(true);
      expect(result.metadata.filePath).toBe(filePath);
      expect(await readTestFile(filePath)).toBe("hello world");
    });

    it("should create a file in a nested directory", async () => {
      const filePath = join(fixturesPath, "nested", "deep", "file.txt");
      const result = await write({
        filePath,
        content: "nested content",
      });

      expect(result.metadata.created).toBe(true);
      expect(await readTestFile(filePath)).toBe("nested content");
    });

    it("should create an empty file", async () => {
      const filePath = join(fixturesPath, "empty-new.txt");
      const result = await write({
        filePath,
        content: "",
      });

      expect(result.metadata.created).toBe(true);
      expect(result.metadata.linesWritten).toBe(0);
      expect(await readTestFile(filePath)).toBe("");
    });

    it("should report correct number of lines written", async () => {
      const filePath = join(fixturesPath, "multiline-new.txt");
      const content = "line 1\nline 2\nline 3";
      const result = await write({
        filePath,
        content,
      });

      expect(result.metadata.linesWritten).toBe(3);
    });
  });

  describe("overwriting existing files", () => {
    it("should overwrite an existing file", async () => {
      const filePath = await createTestFile("overwrite.txt", "original content");
      const result = await write({
        filePath,
        content: "new content",
      });

      expect(result.metadata.created).toBe(false);
      expect(result.title).toContain("Overwrote");
      expect(await readTestFile(filePath)).toBe("new content");
    });

    it("should completely replace file content", async () => {
      const originalContent = "line 1\nline 2\nline 3\nline 4\nline 5";
      const filePath = await createTestFile("full-replace.txt", originalContent);
      const result = await write({
        filePath,
        content: "single line",
      });

      expect(result.metadata.created).toBe(false);
      expect(await readTestFile(filePath)).toBe("single line");
    });

    it("should handle overwriting with empty content", async () => {
      const filePath = await createTestFile("to-empty.txt", "some content");
      const result = await write({
        filePath,
        content: "",
      });

      expect(result.metadata.created).toBe(false);
      expect(result.metadata.linesWritten).toBe(0);
      expect(await readTestFile(filePath)).toBe("");
    });
  });

  describe("diff output", () => {
    it("should generate unified diff for new file", async () => {
      const filePath = join(fixturesPath, "diff-new.txt");
      const result = await write({
        filePath,
        content: "hello world",
      });

      expect(result.output).toContain("+hello world");
    });

    it("should generate unified diff for overwrite", async () => {
      const filePath = await createTestFile("diff-overwrite.txt", "old content");
      const result = await write({
        filePath,
        content: "new content",
      });

      expect(result.output).toContain("-old content");
      expect(result.output).toContain("+new content");
    });

    it("should show multi-line changes in diff", async () => {
      const filePath = await createTestFile("diff-multi.txt", "line 1\nline 2");
      const result = await write({
        filePath,
        content: "new 1\nnew 2\nnew 3",
      });

      expect(result.output).toContain("-line 1");
      expect(result.output).toContain("-line 2");
      expect(result.output).toContain("+new 1");
      expect(result.output).toContain("+new 2");
      expect(result.output).toContain("+new 3");
    });
  });

  describe("error handling", () => {
    it("should throw INVALID_PATH for relative path", async () => {
      await expect(
        write({
          filePath: "relative/path.txt",
          content: "test",
        })
      ).rejects.toMatchObject({
        type: WriteErrorType.INVALID_PATH,
      });
    });

    it("should throw PATH_IS_DIRECTORY for directory path", async () => {
      await expect(
        write({
          filePath: fixturesPath,
          content: "test",
        })
      ).rejects.toMatchObject({
        type: WriteErrorType.PATH_IS_DIRECTORY,
      });
    });

    it("should throw WriteError with correct error type", async () => {
      await expect(
        write({
          filePath: "not-absolute.txt",
          content: "test",
        })
      ).rejects.toThrow(WriteError);
    });
  });

  describe("content handling", () => {
    it("should handle unicode content", async () => {
      const filePath = join(fixturesPath, "unicode.txt");
      const content = "Hello 世界 🌍 مرحبا";
      const result = await write({
        filePath,
        content,
      });

      expect(result.metadata.created).toBe(true);
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle content with special characters", async () => {
      const filePath = join(fixturesPath, "special-chars.txt");
      const content = 'Price: $100.00\nPath: /usr/bin\nRegex: ^a.*b$\nQuote: "test"';
      const result = await write({
        filePath,
        content,
      });

      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle very large content", async () => {
      const filePath = join(fixturesPath, "large-file.txt");
      const content = "a".repeat(100000);
      const result = await write({
        filePath,
        content,
      });

      expect(result.metadata.linesWritten).toBe(1);
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle content with mixed line endings", async () => {
      const filePath = join(fixturesPath, "mixed-endings.txt");
      const content = "line 1\r\nline 2\nline 3\r\n";
      const result = await write({
        filePath,
        content,
      });

      // Content should be written as-is
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle content with tabs and spaces", async () => {
      const filePath = join(fixturesPath, "whitespace.txt");
      const content = "\t  tab and spaces  \t\n  more spaces  ";
      const result = await write({
        filePath,
        content,
      });

      expect(await readTestFile(filePath)).toBe(content);
    });
  });

  describe("schema validation", () => {
    it("should validate correct input", () => {
      const input = {
        filePath: "/path/to/file.txt",
        content: "test content",
      };

      expect(() => WriteInputSchema.parse(input)).not.toThrow();
    });

    it("should require filePath", () => {
      expect(() =>
        WriteInputSchema.parse({
          content: "test",
        })
      ).toThrow();
    });

    it("should require content", () => {
      expect(() =>
        WriteInputSchema.parse({
          filePath: "/path/to/file.txt",
        })
      ).toThrow();
    });

    it("should allow empty content string", () => {
      const input = {
        filePath: "/path/to/file.txt",
        content: "",
      };

      expect(() => WriteInputSchema.parse(input)).not.toThrow();
    });

    it("should validate output matches WriteOutputSchema", async () => {
      const filePath = join(fixturesPath, "schema-out.txt");
      const result = await write({
        filePath,
        content: "test content",
      });

      expect(() => WriteOutputSchema.parse(result)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle file with trailing newline", async () => {
      const filePath = join(fixturesPath, "trailing-newline.txt");
      const content = "line 1\nline 2\n";
      const result = await write({
        filePath,
        content,
      });

      expect(result.metadata.linesWritten).toBe(3);
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle file with only newlines", async () => {
      const filePath = join(fixturesPath, "only-newlines.txt");
      const content = "\n\n\n";
      const result = await write({
        filePath,
        content,
      });

      expect(result.metadata.linesWritten).toBe(4);
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should handle binary-like content", async () => {
      const filePath = join(fixturesPath, "binary-like.txt");
      // Content with null bytes and control characters
      const content = "start\x00middle\x01end";
      const result = await write({
        filePath,
        content,
      });

      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should create parent directories that dont exist", async () => {
      const deepPath = join(fixturesPath, "a", "b", "c", "d", "file.txt");
      const result = await write({
        filePath: deepPath,
        content: "deep nested content",
      });

      expect(result.metadata.created).toBe(true);
      expect(await fileExists(deepPath)).toBe(true);
    });

    it("should handle overwriting same content", async () => {
      const content = "same content";
      const filePath = await createTestFile("same-content.txt", content);
      const result = await write({
        filePath,
        content,
      });

      // Should still succeed even if content is identical
      expect(result.metadata.created).toBe(false);
      expect(await readTestFile(filePath)).toBe(content);
    });
  });
});
