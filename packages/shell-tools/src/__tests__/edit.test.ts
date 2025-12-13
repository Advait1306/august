import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  edit,
  EditInputSchema,
  EditOutputSchema,
  EditError,
  EditErrorType,
} from "../edit";
import { join } from "path";
import { mkdir, writeFile, rm, readFile } from "fs/promises";

const fixturesPath = join(__dirname, "fixtures-edit-test");

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

describe("edit", () => {
  describe("basic replacements", () => {
    it("should replace a simple string", async () => {
      const filePath = await createTestFile("simple.txt", "hello world");
      const result = await edit({
        filePath,
        oldString: "world",
        newString: "universe",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("hello universe");
    });

    it("should replace a multi-line string", async () => {
      const content = `line 1
line 2
line 3`;
      const filePath = await createTestFile("multiline.txt", content);
      const result = await edit({
        filePath,
        oldString: "line 2",
        newString: "replaced line",
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("replaced line");
      expect(newContent).not.toContain("line 2");
    });

    it("should replace a multi-line block", async () => {
      const content = `function hello() {
  console.log("hello");
}

function goodbye() {
  console.log("goodbye");
}`;
      const filePath = await createTestFile("block.ts", content);
      const result = await edit({
        filePath,
        oldString: `function hello() {
  console.log("hello");
}`,
        newString: `function greet() {
  console.log("greetings");
}`,
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("function greet()");
      expect(newContent).toContain('console.log("greetings")');
      expect(newContent).not.toContain("function hello()");
    });

    it("should handle special characters", async () => {
      const content = "Price: $100.00 (including tax)";
      const filePath = await createTestFile("special.txt", content);
      const result = await edit({
        filePath,
        oldString: "$100.00",
        newString: "$200.00",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe(
        "Price: $200.00 (including tax)"
      );
    });

    it("should handle regex special characters in replacement", async () => {
      const content = "Replace this";
      const filePath = await createTestFile("regex-special.txt", content);
      const result = await edit({
        filePath,
        oldString: "this",
        newString: "$& test $1 $` $'",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("Replace $& test $1 $` $'");
    });
  });

  describe("replaceAll", () => {
    it("should replace all occurrences when replaceAll is true", async () => {
      const content = "foo bar foo baz foo";
      const filePath = await createTestFile("replace-all.txt", content);
      const result = await edit({
        filePath,
        oldString: "foo",
        newString: "qux",
        replaceAll: true,
      });

      expect(result.metadata.replacements).toBe(3);
      expect(await readTestFile(filePath)).toBe("qux bar qux baz qux");
    });

    it("should throw error for multiple matches without replaceAll", async () => {
      const content = "foo bar foo baz foo";
      const filePath = await createTestFile("multiple-no-flag.txt", content);

      await expect(
        edit({
          filePath,
          oldString: "foo",
          newString: "qux",
        })
      ).rejects.toThrow(EditError);

      await expect(
        edit({
          filePath,
          oldString: "foo",
          newString: "qux",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.MULTIPLE_MATCHES,
      });
    });
  });

  describe("line ending preservation", () => {
    it("should preserve CRLF line endings", async () => {
      const content = "line 1\r\nline 2\r\nline 3";
      const filePath = await createTestFile("crlf.txt", content);
      const result = await edit({
        filePath,
        oldString: "line 2",
        newString: "replaced",
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toBe("line 1\r\nreplaced\r\nline 3");
    });

    it("should preserve LF line endings", async () => {
      const content = "line 1\nline 2\nline 3";
      const filePath = await createTestFile("lf.txt", content);
      const result = await edit({
        filePath,
        oldString: "line 2",
        newString: "replaced",
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toBe("line 1\nreplaced\nline 3");
    });
  });

  describe("diff output", () => {
    it("should generate unified diff output", async () => {
      const content = "hello world";
      const filePath = await createTestFile("diff-test.txt", content);
      const result = await edit({
        filePath,
        oldString: "world",
        newString: "universe",
      });

      expect(result.output).toContain("-hello world");
      expect(result.output).toContain("+hello universe");
    });

    it("should count additions and deletions", async () => {
      const content = `line 1
line 2
line 3`;
      const filePath = await createTestFile("count-test.txt", content);
      const result = await edit({
        filePath,
        oldString: "line 2",
        newString: "new line A\nnew line B",
      });

      expect(result.metadata.deletions).toBeGreaterThan(0);
      expect(result.metadata.additions).toBeGreaterThan(0);
    });

    it("should correctly count changes when file contains duplicate lines", async () => {
      // Regression test for line count accuracy bug
      // The Set-based approach failed when files contained duplicate lines
      const content = "line1\nline1\nline2";
      const filePath = await createTestFile("duplicate-lines.txt", content);
      const result = await edit({
        filePath,
        oldString: "line1\nline1",
        newString: "line1\nline3",
      });

      // Should replace first two lines, reporting 1 deletion and 1 addition
      expect(result.metadata.replacements).toBe(1);
      expect(result.metadata.deletions).toBe(1);
      expect(result.metadata.additions).toBe(1);
      expect(await readTestFile(filePath)).toBe("line1\nline3\nline2");
    });
  });

  describe("error handling", () => {
    it("should throw FILE_NOT_FOUND for non-existent file", async () => {
      const filePath = join(fixturesPath, "nonexistent.txt");

      await expect(
        edit({
          filePath,
          oldString: "test",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.FILE_NOT_FOUND,
      });
    });

    it("should throw PATH_IS_DIRECTORY for directory path", async () => {
      await expect(
        edit({
          filePath: fixturesPath,
          oldString: "test",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.PATH_IS_DIRECTORY,
      });
    });

    it("should throw NO_MATCH_FOUND when oldString not in file", async () => {
      const filePath = await createTestFile("no-match.txt", "hello world");

      await expect(
        edit({
          filePath,
          oldString: "notfound",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.NO_MATCH_FOUND,
      });
    });

    it("should throw NO_CHANGE when oldString equals newString", async () => {
      const filePath = await createTestFile("no-change.txt", "hello world");

      await expect(
        edit({
          filePath,
          oldString: "world",
          newString: "world",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.NO_CHANGE,
      });
    });

    it("should throw INVALID_PATH for relative path", async () => {
      await expect(
        edit({
          filePath: "relative/path.txt",
          oldString: "test",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.INVALID_PATH,
      });
    });
  });

  describe("cascading strategies", () => {
    it("should match with trailing whitespace differences", async () => {
      const content = "line 1   \nline 2\nline 3";
      const filePath = await createTestFile("trailing-ws.txt", content);

      // Search without trailing whitespace should still match
      const result = await edit({
        filePath,
        oldString: "line 1",
        newString: "replaced",
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("replaced");
    });

    it("should match with different indentation levels", async () => {
      const content = `function test() {
    const x = 1;
    return x;
}`;
      const filePath = await createTestFile("indentation.ts", content);

      // Search with 2-space indent should match 4-space indent
      const result = await edit({
        filePath,
        oldString: `  const x = 1;
  return x;`,
        newString: `  const x = 2;
  return x * 2;`,
      });

      expect(result.metadata.replacements).toBe(1);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("const x = 2");
    });
  });

  describe("schema validation", () => {
    it("should validate correct input", () => {
      const input = {
        filePath: "/path/to/file.txt",
        oldString: "old",
        newString: "new",
        replaceAll: false,
      };

      expect(() => EditInputSchema.parse(input)).not.toThrow();
    });

    it("should require filePath", () => {
      expect(() =>
        EditInputSchema.parse({
          oldString: "old",
          newString: "new",
        })
      ).toThrow();
    });

    it("should require oldString", () => {
      expect(() =>
        EditInputSchema.parse({
          filePath: "/path/to/file.txt",
          newString: "new",
        })
      ).toThrow();
    });

    it("should require newString", () => {
      expect(() =>
        EditInputSchema.parse({
          filePath: "/path/to/file.txt",
          oldString: "old",
        })
      ).toThrow();
    });

    it("should default replaceAll to false", () => {
      const input = {
        filePath: "/path/to/file.txt",
        oldString: "old",
        newString: "new",
      };

      const parsed = EditInputSchema.parse(input);
      expect(parsed.replaceAll).toBe(false);
    });

    it("should validate output matches EditOutputSchema", async () => {
      const filePath = await createTestFile("schema-out.txt", "hello world");
      const result = await edit({
        filePath,
        oldString: "world",
        newString: "universe",
      });

      expect(() => EditOutputSchema.parse(result)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty file", async () => {
      const filePath = await createTestFile("empty.txt", "");

      await expect(
        edit({
          filePath,
          oldString: "test",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.NO_MATCH_FOUND,
      });
    });

    it("should handle file with only newlines", async () => {
      const content = "\n\n\n";
      const filePath = await createTestFile("newlines.txt", content);

      await expect(
        edit({
          filePath,
          oldString: "test",
          newString: "replaced",
        })
      ).rejects.toMatchObject({
        type: EditErrorType.NO_MATCH_FOUND,
      });
    });

    it("should handle replacing with empty string", async () => {
      const content = "hello world";
      const filePath = await createTestFile("empty-new.txt", content);
      const result = await edit({
        filePath,
        oldString: " world",
        newString: "",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("hello");
    });

    it("should handle unicode content", async () => {
      const content = "Hello 世界 🌍";
      const filePath = await createTestFile("unicode.txt", content);
      const result = await edit({
        filePath,
        oldString: "世界",
        newString: "宇宙",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("Hello 宇宙 🌍");
    });

    it("should handle very long lines", async () => {
      const longLine = "a".repeat(10000);
      const content = `start\n${longLine}\nend`;
      const filePath = await createTestFile("long-line.txt", content);
      const result = await edit({
        filePath,
        oldString: longLine,
        newString: "short",
      });

      expect(result.metadata.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("start\nshort\nend");
    });
  });
});
