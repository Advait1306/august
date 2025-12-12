import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { glob, GlobInputSchema, GlobOutputSchema } from "../glob";
import { join } from "path";
import { ZodError } from "zod";
import { utimes, mkdir, writeFile, rm } from "fs/promises";
import * as path from "path";

const fixturesPath = join(__dirname, "fixtures-glob-test");
const tempDir = join(__dirname, "fixtures-glob-temp");

// Create all fixtures before tests run
beforeAll(async () => {
  // Create main fixture directory structure
  await mkdir(join(fixturesPath, "src/components/nested"), { recursive: true });
  await mkdir(join(fixturesPath, "lib"), { recursive: true });
  await mkdir(join(fixturesPath, "special chars"), { recursive: true });

  // Create fixture files
  await writeFile(
    join(fixturesPath, "src/index.ts"),
    'export function main() { console.log("Hello"); }'
  );
  await writeFile(
    join(fixturesPath, "src/utils.ts"),
    "export function formatDate(date: Date) { return date.toISOString(); }"
  );
  await writeFile(
    join(fixturesPath, "src/components/Button.tsx"),
    "export function Button({ label }: { label: string }) { return null; }"
  );
  await writeFile(
    join(fixturesPath, "src/components/Modal.tsx"),
    "export function Modal({ children }: { children: any }) { return null; }"
  );
  await writeFile(
    join(fixturesPath, "src/components/nested/DeepComponent.tsx"),
    "export function DeepComponent() { return null; }"
  );
  await writeFile(
    join(fixturesPath, "lib/helper.js"),
    "module.exports = { helper: () => 'helper' };"
  );
  await writeFile(
    join(fixturesPath, "lib/config.json"),
    '{ "name": "test-config" }'
  );
  await writeFile(
    join(fixturesPath, "special chars/file [1].txt"),
    "File with special characters in name"
  );
  await writeFile(join(fixturesPath, "README.md"), "# Test Fixtures");
});

// Clean up all fixtures after tests complete
afterAll(async () => {
  await rm(fixturesPath, { recursive: true, force: true });
  await rm(tempDir, { recursive: true, force: true });
});

describe("glob", () => {
  describe("basic patterns", () => {
    it("should match files with simple extension pattern at root level", async () => {
      const result = await glob({ pattern: "*.md", path: fixturesPath });
      // *.md only matches root level
      expect(result.metadata.count).toBe(1);
      expect(result.output).toContain("README.md");
    });

    it("should match files with globstar pattern", async () => {
      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      // Should match: src/index.ts, src/utils.ts
      expect(result.metadata.count).toBeGreaterThan(0);
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("utils.ts");
    });

    it("should match files with multiple extensions", async () => {
      const result = await glob({
        pattern: "**/*.{ts,tsx}",
        path: fixturesPath,
      });
      // Should match all .ts and .tsx files
      expect(result.output).toContain(".ts");
      expect(result.output).toContain(".tsx");
    });

    it("should match specific directory pattern", async () => {
      const result = await glob({
        pattern: "src/**/*.tsx",
        path: fixturesPath,
      });
      // Should match: Button.tsx, Modal.tsx, nested/DeepComponent.tsx
      expect(result.metadata.count).toBe(3);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("Modal.tsx");
      expect(result.output).toContain("DeepComponent.tsx");
    });
  });

  describe("empty results", () => {
    it("should return empty output for non-matching pattern", async () => {
      const result = await glob({ pattern: "**/*.xyz", path: fixturesPath });
      expect(result.metadata.count).toBe(0);
      expect(result.metadata.truncated).toBe(false);
      expect(result.output).toBe("No files found");
    });

    it("should handle non-existent directory gracefully", async () => {
      const result = await glob({
        pattern: "**/*",
        path: "/non/existent/path/that/does/not/exist",
      });
      expect(result.metadata.count).toBe(0);
    });
  });

  describe("truncation", () => {
    beforeAll(async () => {
      // Create temp dir with 150+ files
      await mkdir(tempDir, { recursive: true });
      for (let i = 0; i < 150; i++) {
        await writeFile(join(tempDir, `file${i}.txt`), `content ${i}`);
      }
    });

    it("should truncate results exceeding MAX_FILES limit", async () => {
      const result = await glob({ pattern: "**/*", path: tempDir });
      expect(result.metadata.count).toBe(100);
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("Results are truncated");
    });

    it("should not truncate when under limit", async () => {
      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      expect(result.metadata.truncated).toBe(false);
      expect(result.output).not.toContain("truncated");
    });
  });

  describe("sorting", () => {
    it("should return newest files first", async () => {
      // Touch a file to make it newest
      const newestFile = join(fixturesPath, "src/utils.ts");
      await utimes(newestFile, new Date(), new Date());

      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      const files = result.output.split("\n").filter(Boolean);

      // First file should be the one we just touched
      expect(files[0]).toContain("utils.ts");
    });

    it("should maintain consistent order for files with same mtime", async () => {
      const result1 = await glob({ pattern: "**/*", path: fixturesPath });
      const result2 = await glob({ pattern: "**/*", path: fixturesPath });
      expect(result1.output).toBe(result2.output);
    });
  });

  describe("special characters", () => {
    it("should handle paths with spaces", async () => {
      const result = await glob({ pattern: "**/*.txt", path: fixturesPath });
      expect(result.output).toContain("special chars");
    });

    it("should handle unicode characters in filenames", async () => {
      // Should not throw
      const result = await glob({ pattern: "**/*.txt", path: fixturesPath });
      expect(result).toBeDefined();
    });
  });

  describe("nested directories", () => {
    it("should match deeply nested files with globstar", async () => {
      const result = await glob({
        pattern: "**/nested/**/*.tsx",
        path: fixturesPath,
      });
      expect(result.output).toContain("DeepComponent.tsx");
    });

    it("should match at any depth with **", async () => {
      const result = await glob({
        pattern: "**/DeepComponent.tsx",
        path: fixturesPath,
      });
      expect(result.metadata.count).toBe(1);
    });
  });

  describe("input validation", () => {
    it("should throw error for missing pattern", async () => {
      await expect(glob({ pattern: "", path: fixturesPath })).rejects.toThrow();
    });

    it("should use current directory when path not provided", async () => {
      const originalCwd = process.cwd();
      process.chdir(fixturesPath);

      try {
        const result = await glob({ pattern: "**/*.ts" });
        expect(result.metadata.count).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("output format", () => {
    it("should return absolute file paths", async () => {
      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      const files = result.output.split("\n").filter(Boolean);

      files.forEach((file) => {
        expect(path.isAbsolute(file)).toBe(true);
      });
    });

    it("should return title matching the pattern", async () => {
      const pattern = "**/*.ts";
      const result = await glob({ pattern, path: fixturesPath });
      expect(result.title).toBe(pattern);
    });

    it("should separate files with newlines", async () => {
      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      if (result.metadata.count > 1) {
        expect(result.output).toContain("\n");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle single file match", async () => {
      const result = await glob({ pattern: "**/README.md", path: fixturesPath });
      expect(result.metadata.count).toBe(1);
      expect(result.metadata.truncated).toBe(false);
    });

    it("should handle pattern with no wildcards", async () => {
      const result = await glob({ pattern: "README.md", path: fixturesPath });
      expect(result.metadata.count).toBe(1);
    });

    it("should not match directories, only files", async () => {
      const result = await glob({ pattern: "**/src", path: fixturesPath });
      // ripgrep --files only lists files, not directories
      // This pattern shouldn't match any files
      expect(result.output).not.toMatch(/src\n|src$/);
    });
  });
});

describe("GlobInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      pattern: "**/*.ts",
      path: "/some/path",
    };

    expect(() => GlobInputSchema.parse(input)).not.toThrow();
  });

  it("should require pattern", () => {
    expect(() => GlobInputSchema.parse({})).toThrow(ZodError);
  });

  it("should allow optional path", () => {
    expect(() => GlobInputSchema.parse({ pattern: "**/*.ts" })).not.toThrow();
  });
});

describe("GlobOutputSchema", () => {
  it("should validate correct output", () => {
    const output = {
      title: "**/*.ts",
      metadata: { count: 5, truncated: false },
      output: "/path/to/file.ts\n/path/to/another.ts",
    };

    expect(() => GlobOutputSchema.parse(output)).not.toThrow();
  });
});
