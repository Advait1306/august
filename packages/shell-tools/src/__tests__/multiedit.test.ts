import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  multiedit,
  MultiEditInputSchema,
  MultiEditOutputSchema,
  MultiEditError,
  MultiEditErrorType,
} from "../multiedit";
import { join } from "path";
import { mkdir, writeFile, rm, readFile } from "fs/promises";

const fixturesPath = join(__dirname, "fixtures-multiedit-test");

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

describe("multiedit", () => {
  describe("basic functionality", () => {
    it("should perform a single edit (like regular edit)", async () => {
      const filePath = await createTestFile("single.txt", "hello world");
      const result = await multiedit({
        filePath,
        edits: [{ oldString: "world", newString: "universe" }],
      });

      expect(result.metadata.totalReplacements).toBe(1);
      expect(result.metadata.editResults).toHaveLength(1);
      expect(result.metadata.editResults[0]?.success).toBe(true);
      expect(await readTestFile(filePath)).toBe("hello universe");
    });

    it("should perform multiple sequential edits", async () => {
      const content = `const x = 1;
const y = 2;
const z = 3;`;
      const filePath = await createTestFile("multiple.ts", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "const x = 1;", newString: "const x = 10;" },
          { oldString: "const y = 2;", newString: "const y = 20;" },
          { oldString: "const z = 3;", newString: "const z = 30;" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(3);
      expect(result.metadata.editResults).toHaveLength(3);
      expect(result.metadata.editResults.every((r) => r.success)).toBe(true);

      const newContent = await readTestFile(filePath);
      expect(newContent).toBe(`const x = 10;
const y = 20;
const z = 30;`);
    });

    it("should perform edits with replaceAll", async () => {
      const content = "foo bar foo baz foo";
      const filePath = await createTestFile("replaceall.txt", content);

      const result = await multiedit({
        filePath,
        edits: [{ oldString: "foo", newString: "qux", replaceAll: true }],
      });

      expect(result.metadata.totalReplacements).toBe(3);
      expect(await readTestFile(filePath)).toBe("qux bar qux baz qux");
    });

    it("should handle mixed replaceAll and single edits", async () => {
      const content = "foo bar foo baz unique";
      const filePath = await createTestFile("mixed.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "foo", newString: "qux", replaceAll: true },
          { oldString: "unique", newString: "special" },
        ],
      });

      // First edit replaces 2 "foo"s, second replaces 1 "unique"
      expect(result.metadata.editResults).toHaveLength(2);
      expect(result.metadata.editResults[0]?.replacements).toBe(2);
      expect(result.metadata.editResults[1]?.replacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("qux bar qux baz special");
    });
  });

  describe("order-dependent edits", () => {
    it("should allow edit that creates text for next edit to find", async () => {
      const content = "hello world";
      const filePath = await createTestFile("create-then-edit.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "world", newString: "beautiful world" },
          { oldString: "beautiful world", newString: "wonderful universe" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe("hello wonderful universe");
    });

    it("should handle edit that removes text next edit would have found", async () => {
      const content = "foo bar baz";
      const filePath = await createTestFile("remove-then-fail.txt", content);

      // First edit removes "bar", second edit tries to find "bar baz"
      await expect(
        multiedit({
          filePath,
          edits: [
            { oldString: "bar", newString: "qux" },
            { oldString: "bar baz", newString: "replaced" },
          ],
        })
      ).rejects.toMatchObject({
        editIndex: 1,
        type: MultiEditErrorType.NO_MATCH_FOUND,
      });

      // File should be unchanged due to atomic behavior
      expect(await readTestFile(filePath)).toBe("foo bar baz");
    });

    it("should apply edits in array order", async () => {
      const content = "A B C";
      const filePath = await createTestFile("order.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "A", newString: "X" },
          { oldString: "B", newString: "Y" },
          { oldString: "C", newString: "Z" },
        ],
      });

      expect(result.metadata.editResults.map((r) => r.index)).toEqual([0, 1, 2]);
      expect(await readTestFile(filePath)).toBe("X Y Z");
    });
  });

  describe("error cases", () => {
    it("should throw for invalid file path (relative)", async () => {
      await expect(
        multiedit({
          filePath: "relative/path.txt",
          edits: [{ oldString: "test", newString: "replaced" }],
        })
      ).rejects.toMatchObject({
        editIndex: -1,
        type: MultiEditErrorType.INVALID_PATH,
      });
    });

    it("should throw for non-existent file", async () => {
      const filePath = join(fixturesPath, "nonexistent.txt");

      await expect(
        multiedit({
          filePath,
          edits: [{ oldString: "test", newString: "replaced" }],
        })
      ).rejects.toMatchObject({
        editIndex: -1,
        type: MultiEditErrorType.FILE_NOT_FOUND,
      });
    });

    it("should throw for directory path", async () => {
      await expect(
        multiedit({
          filePath: fixturesPath,
          edits: [{ oldString: "test", newString: "replaced" }],
        })
      ).rejects.toMatchObject({
        editIndex: -1,
        type: MultiEditErrorType.PATH_IS_DIRECTORY,
      });
    });

    it("should throw with edit index for no match in first edit", async () => {
      const filePath = await createTestFile("no-match-first.txt", "hello world");

      await expect(
        multiedit({
          filePath,
          edits: [{ oldString: "notfound", newString: "replaced" }],
        })
      ).rejects.toMatchObject({
        editIndex: 0,
        type: MultiEditErrorType.NO_MATCH_FOUND,
      });
    });

    it("should throw for zero matches without replaceAll", async () => {
      const content = "hello world";
      const filePath = await createTestFile("zero-match.txt", content);

      await expect(
        multiedit({
          filePath,
          edits: [
            { oldString: "notfound", newString: "replaced", replaceAll: false },
          ],
        })
      ).rejects.toMatchObject({
        editIndex: 0,
        type: MultiEditErrorType.NO_MATCH_FOUND,
      });

      // File should be unchanged
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should throw with edit index for no match in middle edit", async () => {
      const content = "line 1\nline 2\nline 3";
      const filePath = await createTestFile("no-match-middle.txt", content);

      await expect(
        multiedit({
          filePath,
          edits: [
            { oldString: "line 1", newString: "first" },
            { oldString: "notfound", newString: "replaced" },
            { oldString: "line 3", newString: "third" },
          ],
        })
      ).rejects.toMatchObject({
        editIndex: 1,
        type: MultiEditErrorType.NO_MATCH_FOUND,
      });

      // File should be unchanged (atomic)
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should throw for multiple matches without replaceAll", async () => {
      const content = "foo bar foo baz";
      const filePath = await createTestFile("multiple-matches.txt", content);

      await expect(
        multiedit({
          filePath,
          edits: [{ oldString: "foo", newString: "qux" }],
        })
      ).rejects.toMatchObject({
        editIndex: 0,
        type: MultiEditErrorType.MULTIPLE_MATCHES,
      });
    });

    it("should throw for identical oldString and newString", async () => {
      const filePath = await createTestFile("no-change.txt", "hello world");

      await expect(
        multiedit({
          filePath,
          edits: [{ oldString: "world", newString: "world" }],
        })
      ).rejects.toMatchObject({
        editIndex: 0,
        type: MultiEditErrorType.NO_CHANGE,
      });
    });

    it("should throw for empty edits array", async () => {
      const filePath = await createTestFile("empty-edits.txt", "hello world");

      // Schema should reject empty array
      await expect(
        multiedit({
          filePath,
          edits: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("atomic behavior", () => {
    it("should not modify file if any edit fails", async () => {
      const content = "hello world";
      const filePath = await createTestFile("atomic.txt", content);

      await expect(
        multiedit({
          filePath,
          edits: [
            { oldString: "hello", newString: "hi" },
            { oldString: "notfound", newString: "replaced" },
          ],
        })
      ).rejects.toThrow(MultiEditError);

      // File should be unchanged
      expect(await readTestFile(filePath)).toBe(content);
    });

    it("should apply all edits if validation passes", async () => {
      const content = "A B C D E";
      const filePath = await createTestFile("all-pass.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "A", newString: "1" },
          { oldString: "B", newString: "2" },
          { oldString: "C", newString: "3" },
          { oldString: "D", newString: "4" },
          { oldString: "E", newString: "5" },
        ],
      });

      expect(result.metadata.editResults.every((r) => r.success)).toBe(true);
      expect(await readTestFile(filePath)).toBe("1 2 3 4 5");
    });
  });

  describe("line ending preservation", () => {
    it("should preserve CRLF line endings", async () => {
      const content = "line 1\r\nline 2\r\nline 3";
      const filePath = await createTestFile("crlf.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "line 1", newString: "first" },
          { oldString: "line 2", newString: "second" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe("first\r\nsecond\r\nline 3");
    });

    it("should preserve LF line endings", async () => {
      const content = "line 1\nline 2\nline 3";
      const filePath = await createTestFile("lf.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "line 1", newString: "first" },
          { oldString: "line 2", newString: "second" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe("first\nsecond\nline 3");
    });
  });

  describe("diff output", () => {
    it("should generate unified diff showing all changes", async () => {
      const content = "hello world";
      const filePath = await createTestFile("diff-test.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "hello", newString: "hi" },
          { oldString: "world", newString: "universe" },
        ],
      });

      expect(result.output).toContain("-hello world");
      expect(result.output).toContain("+hi universe");
    });

    it("should count total additions and deletions", async () => {
      const content = `line 1
line 2
line 3`;
      const filePath = await createTestFile("count-test.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "line 1", newString: "new line A\nnew line B" },
          { oldString: "line 3", newString: "final" },
        ],
      });

      expect(result.metadata.totalAdditions).toBeGreaterThan(0);
      expect(result.metadata.totalDeletions).toBeGreaterThan(0);
    });
  });

  describe("cascading strategies", () => {
    it("should match with trailing whitespace differences", async () => {
      const content = "line 1   \nline 2\nline 3";
      const filePath = await createTestFile("trailing-ws.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "line 1", newString: "first" },
          { oldString: "line 2", newString: "second" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("first");
      expect(newContent).toContain("second");
    });

    it("should match with different indentation levels", async () => {
      const content = `function test() {
    const x = 1;
    const y = 2;
    return x + y;
}`;
      const filePath = await createTestFile("indentation.ts", content);

      // Search with 2-space indent should match 4-space indent
      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "  const x = 1;", newString: "  const x = 10;" },
          { oldString: "  const y = 2;", newString: "  const y = 20;" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      const newContent = await readTestFile(filePath);
      expect(newContent).toContain("const x = 10;");
      expect(newContent).toContain("const y = 20;");
    });
  });

  describe("edge cases", () => {
    it("should handle empty file", async () => {
      const filePath = await createTestFile("empty.txt", "");

      await expect(
        multiedit({
          filePath,
          edits: [{ oldString: "test", newString: "replaced" }],
        })
      ).rejects.toMatchObject({
        editIndex: 0,
        type: MultiEditErrorType.NO_MATCH_FOUND,
      });
    });

    it("should handle replacing with empty string", async () => {
      const content = "hello world";
      const filePath = await createTestFile("empty-new.txt", content);

      const result = await multiedit({
        filePath,
        edits: [{ oldString: " world", newString: "" }],
      });

      expect(result.metadata.totalReplacements).toBe(1);
      expect(await readTestFile(filePath)).toBe("hello");
    });

    it("should handle unicode content", async () => {
      const content = "Hello 世界 🌍 Universe 宇宙";
      const filePath = await createTestFile("unicode.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "世界", newString: "地球" },
          { oldString: "宇宙", newString: "銀河" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe("Hello 地球 🌍 Universe 銀河");
    });

    it("should handle special regex characters", async () => {
      const content = "Price: $100.00 (including tax)";
      const filePath = await createTestFile("special.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "$100.00", newString: "$200.00" },
          { oldString: "(including tax)", newString: "(tax included)" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe(
        "Price: $200.00 (tax included)"
      );
    });

    it("should handle regex special characters in replacement", async () => {
      const content = "Replace this and that";
      const filePath = await createTestFile("regex-special.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "this", newString: "$& test $1" },
          { oldString: "that", newString: "$` $'" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(2);
      expect(await readTestFile(filePath)).toBe("Replace $& test $1 and $` $'");
    });

    it("should handle very long lines", async () => {
      const longLine = "a".repeat(10000);
      const content = `start\n${longLine}\nend`;
      const filePath = await createTestFile("long-line.txt", content);

      const result = await multiedit({
        filePath,
        edits: [
          { oldString: "start", newString: "BEGIN" },
          { oldString: longLine, newString: "short" },
          { oldString: "end", newString: "END" },
        ],
      });

      expect(result.metadata.totalReplacements).toBe(3);
      expect(await readTestFile(filePath)).toBe("BEGIN\nshort\nEND");
    });

    it("should handle many edits", async () => {
      // Use zero-padded numbers to avoid "line 1" matching "line 10", etc.
      const lines = Array.from(
        { length: 20 },
        (_, i) => `line_${String(i + 1).padStart(2, "0")}`
      );
      const content = lines.join("\n");
      const filePath = await createTestFile("many-edits.txt", content);

      const edits = lines.map((line, i) => ({
        oldString: line,
        newString: `replaced_${String(i + 1).padStart(2, "0")}`,
      }));

      const result = await multiedit({ filePath, edits });

      expect(result.metadata.totalReplacements).toBe(20);
      expect(result.metadata.editResults).toHaveLength(20);

      const newContent = await readTestFile(filePath);
      for (let i = 1; i <= 20; i++) {
        expect(newContent).toContain(`replaced_${String(i).padStart(2, "0")}`);
      }
    });
  });

  describe("schema validation", () => {
    it("should validate correct input", () => {
      const input = {
        filePath: "/path/to/file.txt",
        edits: [
          { oldString: "old", newString: "new", replaceAll: false },
          { oldString: "another", newString: "replaced" },
        ],
      };

      expect(() => MultiEditInputSchema.parse(input)).not.toThrow();
    });

    it("should require filePath", () => {
      expect(() =>
        MultiEditInputSchema.parse({
          edits: [{ oldString: "old", newString: "new" }],
        })
      ).toThrow();
    });

    it("should require edits array", () => {
      expect(() =>
        MultiEditInputSchema.parse({
          filePath: "/path/to/file.txt",
        })
      ).toThrow();
    });

    it("should require non-empty edits array", () => {
      expect(() =>
        MultiEditInputSchema.parse({
          filePath: "/path/to/file.txt",
          edits: [],
        })
      ).toThrow();
    });

    it("should require oldString in each edit", () => {
      expect(() =>
        MultiEditInputSchema.parse({
          filePath: "/path/to/file.txt",
          edits: [{ newString: "new" }],
        })
      ).toThrow();
    });

    it("should require newString in each edit", () => {
      expect(() =>
        MultiEditInputSchema.parse({
          filePath: "/path/to/file.txt",
          edits: [{ oldString: "old" }],
        })
      ).toThrow();
    });

    it("should default replaceAll to false", () => {
      const input = {
        filePath: "/path/to/file.txt",
        edits: [{ oldString: "old", newString: "new" }],
      };

      const parsed = MultiEditInputSchema.parse(input);
      expect(parsed.edits[0]?.replaceAll).toBe(false);
    });

    it("should validate output matches MultiEditOutputSchema", async () => {
      const filePath = await createTestFile("schema-out.txt", "hello world");
      const result = await multiedit({
        filePath,
        edits: [{ oldString: "world", newString: "universe" }],
      });

      expect(() => MultiEditOutputSchema.parse(result)).not.toThrow();
    });
  });

  describe("error message formatting", () => {
    it("should include 1-indexed edit number in error message", async () => {
      const filePath = await createTestFile("error-msg.txt", "hello world");

      try {
        await multiedit({
          filePath,
          edits: [
            { oldString: "hello", newString: "hi" },
            { oldString: "notfound", newString: "replaced" },
          ],
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(MultiEditError);
        expect((err as MultiEditError).message).toContain("Edit 2:");
        expect((err as MultiEditError).editIndex).toBe(1);
      }
    });
  });
});
