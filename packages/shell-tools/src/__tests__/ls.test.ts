import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ls, LsInputSchema, LsOutputSchema } from "../ls";
import { join } from "path";
import { ZodError } from "zod";
import { mkdir, writeFile, rm } from "fs/promises";

const fixturesPath = join(__dirname, "fixtures-ls-test");

// Isolated subdirectories for different test categories
const basicDir = join(fixturesPath, "basic");
const emptyDir = join(fixturesPath, "empty");
const largeDir = join(fixturesPath, "large");
const hiddenDir = join(fixturesPath, "hidden");
const specialCharsDir = join(fixturesPath, "special-chars");

// Create all fixtures before tests run
beforeAll(async () => {
  // === BASIC DIR: Standard directory with files and subdirectories ===
  // Structure:
  //   basic/
  //     src/
  //     tests/
  //     node_modules/  (should be ignored by default)
  //       dep/
  //     .git/          (should be ignored by default)
  //     index.ts
  //     package.json
  //     README.md
  await mkdir(join(basicDir, "src"), { recursive: true });
  await mkdir(join(basicDir, "tests"), { recursive: true });
  await mkdir(join(basicDir, "node_modules/dep"), { recursive: true });
  await mkdir(join(basicDir, ".git"), { recursive: true });
  await writeFile(join(basicDir, "index.ts"), "export {}");
  await writeFile(join(basicDir, "package.json"), "{}");
  await writeFile(join(basicDir, "README.md"), "# Test");
  await writeFile(join(basicDir, "node_modules/dep/index.js"), "module.exports = {}");
  await writeFile(join(basicDir, ".git/config"), "");

  // === EMPTY DIR: For empty directory tests ===
  await mkdir(emptyDir, { recursive: true });

  // === LARGE DIR: 150+ files for truncation tests ===
  await mkdir(largeDir, { recursive: true });
  for (let i = 0; i < 150; i++) {
    await writeFile(join(largeDir, `file${String(i).padStart(3, "0")}.txt`), `content ${i}`);
  }

  // === HIDDEN DIR: For hidden file tests ===
  // Structure:
  //   hidden/
  //     .hidden-file
  //     .hidden-dir/
  //       secret.ts
  //     visible.txt
  await mkdir(join(hiddenDir, ".hidden-dir"), { recursive: true });
  await writeFile(join(hiddenDir, ".hidden-file"), "hidden content");
  await writeFile(join(hiddenDir, ".hidden-dir/secret.ts"), "export {}");
  await writeFile(join(hiddenDir, "visible.txt"), "visible content");

  // === SPECIAL CHARS DIR: For special character tests ===
  // Structure:
  //   special-chars/
  //     file [1].txt
  //     path with spaces/
  //       nested file.txt
  await mkdir(join(specialCharsDir, "path with spaces"), { recursive: true });
  await writeFile(join(specialCharsDir, "file [1].txt"), "content");
  await writeFile(join(specialCharsDir, "path with spaces/nested file.txt"), "content");
});

// Clean up all fixtures after tests complete
afterAll(async () => {
  await rm(fixturesPath, { recursive: true, force: true });
});

describe("ls", () => {
  describe("basic listing", () => {
    it("should list files and directories in a path", async () => {
      const result = await ls({ path: basicDir });
      expect(result.metadata.count).toBeGreaterThan(0);
      expect(result.output).toContain("[DIR]");
    });

    it("should show directories with [DIR] prefix", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).toContain("[DIR] src");
      expect(result.output).toContain("[DIR] tests");
    });

    it("should list files without prefix", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).toContain("README.md");
      expect(result.output).not.toContain("[DIR] README.md");
    });

    it("should include directory path in output header", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).toContain(`Directory listing for ${basicDir}`);
    });
  });

  describe("sorting", () => {
    it("should list directories before files", async () => {
      const result = await ls({ path: basicDir });
      const lines = result.output.split("\n").filter((l) => l && !l.startsWith("Directory") && !l.startsWith("("));

      // Find first file (no [DIR] prefix)
      const firstFileIndex = lines.findIndex((l) => !l.includes("[DIR]"));
      // Find last directory index manually (findLastIndex requires ES2023)
      let lastDirIndex = -1;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes("[DIR]")) {
          lastDirIndex = i;
          break;
        }
      }

      if (lastDirIndex !== -1 && firstFileIndex !== -1) {
        expect(lastDirIndex).toBeLessThan(firstFileIndex);
      }
    });

    it("should sort directories alphabetically", async () => {
      const result = await ls({ path: basicDir });
      const dirs = result.output
        .split("\n")
        .filter((l) => l.includes("[DIR]"))
        .map((l) => l.replace("[DIR] ", ""));

      expect(dirs).toEqual([...dirs].sort());
    });

    it("should sort files alphabetically", async () => {
      const result = await ls({ path: basicDir });
      const files = result.output
        .split("\n")
        .filter((l) => l && !l.includes("[DIR]") && !l.startsWith("Directory") && !l.startsWith("("));

      // localeCompare is used for case-insensitive sorting
      expect(files).toEqual([...files].sort((a, b) => a.localeCompare(b)));
    });
  });

  describe("ignore patterns", () => {
    it("should ignore node_modules by default", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).not.toContain("node_modules");
    });

    it("should ignore .git by default", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).not.toContain("[DIR] .git");
    });

    it("should apply custom ignore patterns", async () => {
      const result = await ls({
        path: basicDir,
        ignore: ["*.md"],
      });
      expect(result.output).not.toContain("README.md");
    });

    it("should apply custom prefix ignore patterns", async () => {
      const result = await ls({
        path: basicDir,
        ignore: ["index*"],
      });
      expect(result.output).not.toContain("index.ts");
    });

    it("should report ignored count", async () => {
      const result = await ls({ path: basicDir });
      expect(result.output).toContain("ignored");
    });
  });

  describe("truncation", () => {
    it("should truncate results exceeding 100 entries", async () => {
      const result = await ls({ path: largeDir });
      expect(result.metadata.count).toBe(100);
      expect(result.metadata.truncated).toBe(true);
    });

    it("should show truncation message when truncated", async () => {
      const result = await ls({ path: largeDir });
      expect(result.output).toContain("truncated");
    });

    it("should not truncate when under limit", async () => {
      const result = await ls({ path: basicDir });
      expect(result.metadata.truncated).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should throw for non-existent path", async () => {
      await expect(ls({ path: "/non/existent/path/that/does/not/exist" })).rejects.toThrow(
        "Path does not exist"
      );
    });

    it("should throw when path is a file", async () => {
      await expect(ls({ path: join(basicDir, "README.md") })).rejects.toThrow("not a directory");
    });

    it("should throw when path is not absolute", async () => {
      await expect(ls({ path: "relative/path" })).rejects.toThrow("must be absolute");
    });

    it("should throw when path is empty", async () => {
      await expect(ls({ path: "" })).rejects.toThrow("path is required");
    });
  });

  describe("hidden files", () => {
    it("should include hidden files by default", async () => {
      const result = await ls({ path: hiddenDir });
      expect(result.output).toContain(".hidden-file");
    });

    it("should include hidden directories by default", async () => {
      const result = await ls({ path: hiddenDir });
      expect(result.output).toContain("[DIR] .hidden-dir");
    });
  });

  describe("special characters", () => {
    it("should handle paths with spaces", async () => {
      const result = await ls({ path: specialCharsDir });
      expect(result.output).toContain("path with spaces");
    });

    it("should handle files with brackets", async () => {
      const result = await ls({ path: specialCharsDir });
      expect(result.output).toContain("file [1].txt");
    });

    it("should handle listing directory with spaces in path", async () => {
      const result = await ls({ path: join(specialCharsDir, "path with spaces") });
      expect(result.output).toContain("nested file.txt");
    });
  });

  describe("output format", () => {
    it("should include directory path in title", async () => {
      const result = await ls({ path: basicDir });
      expect(result.title).toBe(basicDir);
    });

    it("should have correct metadata structure", async () => {
      const result = await ls({ path: basicDir });
      expect(result.metadata).toHaveProperty("count");
      expect(result.metadata).toHaveProperty("truncated");
      expect(typeof result.metadata.count).toBe("number");
      expect(typeof result.metadata.truncated).toBe("boolean");
    });
  });

  describe("empty directory", () => {
    it("should handle empty directory", async () => {
      const result = await ls({ path: emptyDir });
      expect(result.metadata.count).toBe(0);
      expect(result.output).toContain("Empty directory");
    });
  });
});

describe("LsInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      path: "/some/path",
    };

    expect(() => LsInputSchema.parse(input)).not.toThrow();
  });

  it("should require path", () => {
    expect(() => LsInputSchema.parse({})).toThrow(ZodError);
  });

  it("should allow optional ignore array", () => {
    expect(() =>
      LsInputSchema.parse({ path: "/some/path", ignore: ["*.log", "temp"] })
    ).not.toThrow();
  });

  it("should reject invalid path type via schema", () => {
    expect(() => LsInputSchema.parse({ path: 123 })).toThrow(ZodError);
  });

  it("should reject invalid ignore type via schema", () => {
    expect(() => LsInputSchema.parse({ path: "/some/path", ignore: "*.log" })).toThrow(ZodError);
  });
});

describe("LsOutputSchema", () => {
  it("should validate correct output", () => {
    const output = {
      title: "/some/path",
      metadata: { count: 5, truncated: false },
      output: "Directory listing for /some/path:\n[DIR] src\nindex.ts",
    };

    expect(() => LsOutputSchema.parse(output)).not.toThrow();
  });
});
